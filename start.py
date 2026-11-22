"""Start the local development server and web app with Python 3."""
import os
import secrets
import shutil
import signal
import socket
import subprocess
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


def main():
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
    try:
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


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n已停止。")
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        raise SystemExit(f"启动失败：{exc}")
