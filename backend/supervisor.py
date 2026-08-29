import subprocess
import time
import sys
import os

WORKER_COUNT = int(os.environ.get("WORKER_COUNT", "3"))
workers = {}
log_files = {}

worker_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worker.py")
backend_dir = os.path.dirname(os.path.abspath(__file__))

def start_worker(idx):
    env = os.environ.copy()
    env["PYTHONPATH"] = backend_dir
    
    log_path = os.path.join(backend_dir, f"worker_{idx}.log")
    f = open(log_path, "w")
    log_files[idx] = f
    
    p = subprocess.Popen(
        [sys.executable, "-u", worker_script],
        env=env,
        stdout=f,
        stderr=subprocess.STDOUT
    )
    workers[idx] = p
    print(f"[Supervisor] Started worker #{idx} (PID={p.pid})")

def supervise():
    print(f"[Supervisor] Supervising {WORKER_COUNT} worker processes on {worker_script}...")
    for i in range(WORKER_COUNT):
        start_worker(i)

    while True:
        time.sleep(1)
        for i in range(WORKER_COUNT):
            p = workers.get(i)
            if p is None or p.poll() is not None:
                print(f"[Supervisor] Worker #{i} died or not running. Restarting...")
                start_worker(i)

if __name__ == "__main__":
    try:
        supervise()
    except KeyboardInterrupt:
        print("[Supervisor] Shutting down workers...")
        for p in workers.values():
            p.terminate()
