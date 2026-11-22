"""Start the local app and, by default, its local OCR/speech worker."""
import argparse
import os
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, build_opener


ROOT = Path(__file__).resolve().parent
SERVER = ROOT / "apps" / "server"
WEB = ROOT / "apps" / "web"
WINDOWS = os.name == "nt"
LOCAL_HTTP = build_opener(ProxyHandler({}))


def require_port(port):
    with socket.socket() as sock:
        if not WINDOWS:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
        except OSError as exc:
            raise RuntimeError(f"端口 {port} 不可用，请关闭占用该端口的程序。") from exc


def wait_until_ready(url, process, label, expected_status):
    deadline = time.monotonic() + 60
    last_result = "尚未收到响应"
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"{label}提前退出，退出码 {process.returncode}。")
        try:
            with LOCAL_HTTP.open(url, timeout=1) as response:
                last_result = f"HTTP {response.status}"
                if response.status == expected_status:
                    return
        except HTTPError as exc:
            exc.close()
            last_result = f"HTTP {exc.code}"
            if exc.code == expected_status:
                return
        except (URLError, TimeoutError) as exc:
            last_result = str(exc)
        time.sleep(0.25)
    raise RuntimeError(
        f"{label}启动超时。探测 {url} 预期 HTTP {expected_status}，最近结果：{last_result}"
    )


def stop_tree(process):
    if WINDOWS:
        if process.poll() is None:
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
    else:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        if WINDOWS:
            process.kill()
        else:
            os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def env_file_values(path):
    values = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value
    return values


def set_env_values(path, values):
    lines = path.read_text(encoding="utf-8").splitlines()
    remaining = dict(values)
    output = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in remaining:
                output.append(f"{key}={remaining.pop(key)}")
                continue
        output.append(line)
    if remaining:
        if output and output[-1] != "":
            output.append("")
        output.extend(f"{key}={value}" for key, value in remaining.items())
    path.write_text("\n".join(output) + "\n", encoding="utf-8")
    if not WINDOWS:
        path.chmod(0o600)


def recognition_docker_env(key):
    env = os.environ.copy()
    env.update(
        RECOGNITION_API_KEY=key,
        RECOGNITION_WORKER_URL="http://recognition:8000",
        RECOGNITION_WORKER_PORT="8001",
        RECOGNITION_TIMEOUT_MS="180000",
        RECOGNITION_MAX_FILE_SIZE_MB="10",
        RECOGNITION_MAX_AUDIO_SECONDS="60",
        WHISPER_MODEL="base",
        WHISPER_DEVICE="cpu",
        WHISPER_COMPUTE_TYPE="int8",
        # Compose validates app-service substitutions even when starting only the worker.
        REGISTRATION_INVITE_CODES="local-recognition-worker-only",
    )
    return env


def compose_recognition(arguments, env, check=True, capture_output=False):
    result = subprocess.run(
        ["docker", "compose", "--profile", "recognition", *arguments],
        cwd=ROOT,
        env=env,
        check=False,
        capture_output=capture_output,
        text=True,
    )
    if check and result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, result.args)
    return result


def setup_recognition(config):
    docker = shutil.which("docker")
    if not docker:
        raise RuntimeError(
            "默认拍照 OCR/语音需要 Docker Desktop。请安装并启动 Docker Desktop，"
            "或使用 `python start.py --no-recognition` 只启动核心系统。"
        )
    if subprocess.run(
        [docker, "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False
    ).returncode != 0:
        raise RuntimeError(
            "无法连接 Docker。请启动 Docker Desktop 后重试；"
            "如暂不使用识别，可运行 `python start.py --no-recognition`。"
        )

    values = env_file_values(config)
    key = values.get("RECOGNITION_API_KEY", "")
    if len(key) < 32:
        key = secrets.token_hex(32)
    set_env_values(
        config,
        {
            "RECOGNITION_WORKER_URL": "http://127.0.0.1:8001",
            "RECOGNITION_API_KEY": key,
        },
    )
    docker_env = recognition_docker_env(key)

    running = compose_recognition(
        ["ps", "--status", "running", "-q", "recognition"],
        docker_env,
        check=False,
        capture_output=True,
    )
    already_running = running.returncode == 0 and bool(running.stdout.strip())
    if not already_running:
        require_port(8001)

    started_here = not already_running
    try:
        print("正在准备本机 OCR/语音识别服务…", flush=True)
        compose_recognition(["up", "-d", "recognition"], docker_env)
        wait_until_ready("http://127.0.0.1:8001/health", _RunningProcess(), "本机识别服务", 200)

        cached = compose_recognition(
            ["run", "--rm", "recognition", "python", "/app/preload_models.py", "--check"],
            docker_env,
            check=False,
        )
        if cached.returncode != 0:
            print("首次准备 RapidOCR 和 faster-whisper 模型，需要联网下载，请稍候…", flush=True)
            compose_recognition(
                ["run", "--rm", "recognition", "python", "/app/preload_models.py"],
                docker_env,
            )
        return key, started_here
    except Exception:
        if started_here:
            compose_recognition(["stop", "recognition"], docker_env, check=False)
        raise


class _RunningProcess:
    """Adapt an already-running Compose service to the shared HTTP readiness waiter."""

    @staticmethod
    def poll():
        return None


def main():
    parser = argparse.ArgumentParser(description="启动本地医疗记录系统及本机识别服务。")
    parser.add_argument(
        "--no-recognition",
        action="store_true",
        help="不启动 OCR/语音识别 worker（仍可使用系统其它功能）",
    )
    args = parser.parse_args()

    node = shutil.which("node")
    npm = shutil.which("npm.cmd" if WINDOWS else "npm")
    if not node or not npm:
        raise RuntimeError("请先安装受支持的 Node.js LTS 和 npm。")
    for port in (3000, 5173):
        require_port(port)

    config = SERVER / ".env"
    if not config.exists():
        template = (SERVER / ".env.example").read_text(encoding="utf-8")
        secret = secrets.token_hex(32)
        with config.open("x", encoding="utf-8") as handle:
            handle.write(template.replace("change-me-to-a-long-random-string", secret))
        if not WINDOWS:
            config.chmod(0o600)

    # Give this launcher its own persistent development data.
    env = os.environ.copy()
    env.update(
        NODE_ENV="development",
        PORT="3000",
        BIND_HOST="127.0.0.1",
        DATABASE_URL="file:./local-dev.db",
        FILE_STORAGE="local",
        UPLOAD_PATH="./uploads/local-dev",
        VITE_API_BASE_URL="/api",
    )
    for directory, executable in ((SERVER, "prisma"), (WEB, "vite")):
        cli = directory / "node_modules" / ".bin" / (executable + (".cmd" if WINDOWS else ""))
        if not cli.is_file():
            subprocess.run([npm, "ci", "--include=dev"], cwd=directory, env=env, check=True)

    subprocess.run([npm, "run", "prisma:generate"], cwd=SERVER, env=env, check=True)
    migration_env = env.copy()
    migration_env["RUST_LOG"] = "info"
    subprocess.run(
        [npm, "run", "prisma:migrate:deploy"],
        cwd=SERVER, env=migration_env, check=True,
    )

    process_options = (
        {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
        if WINDOWS else {"start_new_session": True}
    )
    processes = []
    recognition_started_here = False
    recognition_compose_env = None
    try:
        if args.no_recognition:
            env["RECOGNITION_WORKER_URL"] = ""
            print("已跳过 OCR/语音识别服务。", flush=True)
        else:
            key, recognition_started_here = setup_recognition(config)
            recognition_compose_env = recognition_docker_env(key)
            env["RECOGNITION_WORKER_URL"] = "http://127.0.0.1:8001"
            env["RECOGNITION_API_KEY"] = key

        backend = subprocess.Popen(
            [npm, "run", "start:dev"], cwd=SERVER, env=env, **process_options
        )
        processes.append(backend)
        wait_until_ready("http://127.0.0.1:3000/auth/me", backend, "后端", 401)
        frontend = subprocess.Popen(
            [npm, "run", "dev", "--", "--host", "127.0.0.1", "--strictPort"],
            cwd=WEB, env=env, **process_options,
        )
        processes.append(frontend)
        wait_until_ready("http://127.0.0.1:5173/", frontend, "前端", 200)
        wait_until_ready("http://127.0.0.1:5173/api/auth/me", frontend, "前端 API 代理", 401)
        print("开发环境已启动：http://127.0.0.1:5173/ · Ctrl+C 停止", flush=True)
        while all(process.poll() is None for process in processes):
            time.sleep(0.25)
        raise RuntimeError("开发服务提前退出，请检查上面的日志。")
    finally:
        for process in reversed(processes):
            stop_tree(process)
        if recognition_started_here and recognition_compose_env:
            compose_recognition(["stop", "recognition"], recognition_compose_env, check=False)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n已停止。")
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        raise SystemExit(f"启动失败：{exc}")
