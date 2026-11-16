#!/usr/bin/env python3
"""Localhost CONNECT forwarder: Chrome -> 127.0.0.1:3129 -> VM egress proxy.

Reads the upstream proxy (with auth) from HTTPS_PROXY at runtime; nothing
credential-bearing is written to disk or printed. Recreated after VM
replacement wiped /tmp (original built 15 Nov 2026 for the Kane live runs).
Usage: nohup python3 egress-forwarder.py > /tmp/forwarder.log 2>&1 &
Then launch Chrome with --proxy-server=http://127.0.0.1:3129
--proxy-bypass-list=localhost,127.0.0.1 --ignore-certificate-errors.
"""
import base64
import os
import socket
import threading
from urllib.parse import urlparse

UP = urlparse(os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or "")
AUTH = None
if UP.username:
    AUTH = base64.b64encode(f"{UP.username}:{UP.password or ''}".encode()).decode()
UPSTREAM = (UP.hostname, UP.port or 3128)


def pump(a, b):
    try:
        while True:
            d = a.recv(65536)
            if not d:
                break
            b.sendall(d)
    except OSError:
        pass
    finally:
        try:
            b.shutdown(socket.SHUT_WR)
        except OSError:
            pass


def handle(client):
    up = None
    try:
        req = b""
        while b"\r\n\r\n" not in req:
            chunk = client.recv(4096)
            if not chunk:
                return
            req += chunk
        parts = req.split(b"\r\n")[0].decode(errors="replace").split(" ")
        if len(parts) < 2 or parts[0] != "CONNECT":
            client.sendall(b"HTTP/1.1 405 Method Not Allowed\r\n\r\n")
            return
        target = parts[1]
        up = socket.create_connection(UPSTREAM, timeout=30)
        headers = f"CONNECT {target} HTTP/1.1\r\nHost: {target}\r\n"
        if AUTH:
            headers += f"Proxy-Authorization: Basic {AUTH}\r\n"
        headers += "\r\n"
        up.sendall(headers.encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            chunk = up.recv(4096)
            if not chunk:
                break
            resp += chunk
        if b" 200 " not in resp.split(b"\r\n")[0]:
            client.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
            return
        client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        t1 = threading.Thread(target=pump, args=(client, up), daemon=True)
        t2 = threading.Thread(target=pump, args=(up, client), daemon=True)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
    except OSError:
        pass
    finally:
        try:
            client.close()
        except OSError:
            pass
        if up is not None:
            try:
                up.close()
            except OSError:
                pass


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", 3129))
    srv.listen(50)
    print("forwarder listening on 127.0.0.1:3129", flush=True)
    while True:
        client, _ = srv.accept()
        threading.Thread(target=handle, args=(client,), daemon=True).start()


if __name__ == "__main__":
    main()
