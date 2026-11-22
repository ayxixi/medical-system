"""Start the local app and, by default, its local OCR/speech worker."""
import argparse
import atexit
import hashlib
import os
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time
import venv
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, build_opener


ROOT = Path(__file__).resolve().parent
SERVER = ROOT / "apps" / "server"
WEB = ROOT / "apps" / "web"
WINDOWS = os.name == "nt"
LOCAL_HTTP = build_opener(ProxyHandler({}))


def acquire_start_lock():
    """Prevent concurrent launcher instances from racing through port preflight."""
    lock_path = ROOT / ".start.py.lock"
    lock_file = lock_path.open("a+b")
    try:
        if WINDOWS:
            import msvcrt

            lock_file.seek(0, os.SEEK_END)
            if lock_file.tell() == 0:
                lock_file.write(b"0")
                lock_file.flush()
            lock_file.seek(0)
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError as exc:
        lock_file.close()
        raise RuntimeError(
            "检测到另一个 start.py 实例正在运行。请先检查已打开的启动终端，再重试。"
        ) from exc
    atexit.register(lock_file.close)
    return lock_file


def require_port(port, host="127.0.0.1"):
    with socket.socket() as sock:
        if WINDOWS:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        else:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError as exc:
            command = (
                f"请先检查占用进程：`netstat -ano | findstr :{port}`，"
                "确认进程用途后再关闭它，或停止另一个正在运行的开发服务。"
                if WINDOWS
                else f"请检查占用进程（`lsof -i :{port}`），确认后停止它或停止另一个开发服务。"
            )
            raise RuntimeError(f"端口 {port} 已被占用。{command}") from exc


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


def prepare_recognition(config):
    if sys.version_info < (3, 11) or sys.version_info >= (3, 13):
        raise RuntimeError("本机 OCR/语音需要 Python 3.11 或 3.12。")
    recognition = ROOT / "apps" / "recognition"
    environment = recognition / ".venv"
    executable = environment / ("Scripts/python.exe" if WINDOWS else "bin/python")
    if not executable.is_file():
        print("正在创建 OCR/语音识别的 Python 虚拟环境…", flush=True)
        venv.EnvBuilder(with_pip=True).create(environment)

    requirements = recognition / "requirements.txt"
    stamp = environment / ".medical-recognition-dependencies"
    dependency_hash = hashlib.sha256(requirements.read_bytes()).hexdigest()
    if not stamp.is_file() or stamp.read_text(encoding="utf-8") != dependency_hash:
        print("正在本机安装 OCR/语音识别依赖…", flush=True)
        pip_env = os.environ.copy()
        pip_env.setdefault("PIP_DEFAULT_TIMEOUT", "180")
        try:
            subprocess.run(
                [
                    str(executable), "-m", "pip", "install",
                    "--timeout", "180", "--retries", "5",
                    "-r", str(requirements),
                ],
                cwd=recognition,
                env=pip_env,
                check=True,
            )
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(
                "本机识别依赖安装失败。若日志显示网络超时，请检查能否访问 "
                "pypi.org 和 files.pythonhosted.org，然后重新运行 `python start.py`；"
                "也可配置可用的 pip 镜像源后重试。"
            ) from exc
        stamp.write_text(dependency_hash, encoding="utf-8")

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
    worker_env = os.environ.copy()
    worker_env.update(
        RECOGNITION_API_KEY=key,
        RECOGNITION_MODEL_DIR=str(recognition / "models"),
        MAX_MEDIA_SIZE_MB="10",
        MAX_AUDIO_SECONDS="60",
        WHISPER_MODEL="base",
        WHISPER_DEVICE="cpu",
        WHISPER_COMPUTE_TYPE="int8",
    )
    model_dir = Path(worker_env["RECOGNITION_MODEL_DIR"])
    model_dir.mkdir(parents=True, exist_ok=True)
    worker_env["HF_HOME"] = str(model_dir / "huggingface")
    worker_env["RECOGNITION_WORKER_URL"] = "http://127.0.0.1:8001"

    require_port(8001)
    preload_command = [str(executable), "preload_models.py"]
    cached = subprocess.run(
        [*preload_command, "--check"],
        cwd=recognition,
        env=worker_env,
        check=False,
    )
    if cached.returncode != 0:
        print("首次运行将下载 RapidOCR 和 Whisper base 模型，需要联网，请稍候…", flush=True)
        subprocess.run(preload_command, cwd=recognition, env=worker_env, check=True)
    print("正在启动本机 OCR/语音识别服务…", flush=True)
    worker = subprocess.Popen(
        [
            str(executable), "-m", "uvicorn", "worker:app",
            "--host", "127.0.0.1", "--port", "8001",
            "--no-access-log", "--log-level", "warning",
        ],
        cwd=recognition,
        env=worker_env,
        **(
            {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
            if WINDOWS
            else {"start_new_session": True}
        ),
    )
    try:
        wait_until_ready("http://127.0.0.1:8001/health", worker, "本机识别服务", 200)
    except Exception:
        stop_tree(worker)
        raise
    return key, worker


def main():
    parser = argparse.ArgumentParser(description="启动本地医疗记录系统及本机识别服务。")
    parser.add_argument(
        "--no-recognition",
        action="store_true",
        help="不启动 OCR/语音识别 worker（仍可使用系统其它功能）",
    )
    parser.add_argument("--backend-port", type=int, default=3000, help="后端监听端口")
    parser.add_argument("--lan", action="store_true", help="允许局域网设备访问前端")
    args = parser.parse_args()
    web_host = "0.0.0.0" if args.lan else "127.0.0.1"
    backend_port = args.backend_port
    if not 1 <= backend_port <= 65535 or backend_port == 5173 or (
        backend_port == 8001 and not args.no_recognition
    ):
        parser.error("后端端口须在 1–65535 范围内，且不能与前端或已启用的识别服务重复。")
    backend_url = f"http://127.0.0.1:{backend_port}"
    acquire_start_lock()
    if WINDOWS:
        from windows_job import bind_launcher_lifetime

        try:
            bind_launcher_lifetime()
        except OSError as exc:
            raise RuntimeError(f"无法启用 Windows 服务自动清理：{exc}") from exc

    node = shutil.which("node")
    npm = shutil.which("npm.cmd" if WINDOWS else "npm")
    if not node or not npm:
        raise RuntimeError("请先安装受支持的 Node.js LTS 和 npm。")
    require_port(backend_port)
    require_port(5173, web_host)

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
        PORT=str(backend_port),
        MEDICAL_DEV_API_TARGET=backend_url,
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

    subprocess.run([npm, "run", "build"], cwd=SERVER, env=env, check=True)

    process_options = (
        {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
        if WINDOWS else {"start_new_session": True}
    )
    processes = []
    recognition_process = None
    try:
        if args.no_recognition:
            env["RECOGNITION_WORKER_URL"] = ""
            print("已跳过 OCR/语音识别服务。", flush=True)
        else:
            key, recognition_process = prepare_recognition(config)
            processes.append(recognition_process)
            env["RECOGNITION_WORKER_URL"] = "http://127.0.0.1:8001"
            env["RECOGNITION_API_KEY"] = key

        # Repeat the preflight after dependency installation/model downloads. The
        # initial check alone leaves a long window in which another app could bind.
        require_port(backend_port)
        require_port(5173, web_host)
        backend = subprocess.Popen(
            [node, "--enable-source-maps", str(SERVER / "dist" / "main")], cwd=SERVER, env=env, **process_options
        )
        processes.append(backend)
        wait_until_ready(f"{backend_url}/auth/me", backend, "后端", 401)
        require_port(5173, web_host)
        frontend = subprocess.Popen(
            [npm, "run", "dev", "--", "--host", web_host, "--strictPort"],
            cwd=WEB, env=env, **process_options,
        )
        processes.append(frontend)
        wait_until_ready("http://127.0.0.1:5173/", frontend, "前端", 200)
        wait_until_ready("http://127.0.0.1:5173/api/auth/me", frontend, "前端 API 代理", 401)
        print("开发环境已启动：http://127.0.0.1:5173/ · Ctrl+C 停止", flush=True)
        if args.lan:
            print("手机请访问 Vite 输出的 Network 地址，选择电脑 Wi-Fi 或有线网卡的 IPv4。", flush=True)
        while all(process.poll() is None for process in processes):
            time.sleep(0.25)
        raise RuntimeError("开发服务提前退出，请检查上面的日志。")
    finally:
        for process in reversed(processes):
            stop_tree(process)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n已停止。")
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        raise SystemExit(f"启动失败：{exc}")
