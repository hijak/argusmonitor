#!/usr/bin/env python3
import os
import socket
import threading

LISTEN_HOST = os.environ.get('LISTEN_HOST', '0.0.0.0')
LISTEN_PORT = int(os.environ.get('LISTEN_PORT', '16443'))
TARGET_HOST = os.environ.get('TARGET_HOST', '10.13.37.41')
TARGET_PORT = int(os.environ.get('TARGET_PORT', '6443'))


def pipe(src, dst):
    try:
        while True:
            data = src.recv(65536)
            if not data:
                break
            dst.sendall(data)
    except Exception:
        pass
    finally:
        for s in (src, dst):
            try:
                s.shutdown(socket.SHUT_RDWR)
            except Exception:
                pass
            try:
                s.close()
            except Exception:
                pass


def handle(client_sock):
    upstream = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    upstream.connect((TARGET_HOST, TARGET_PORT))
    threading.Thread(target=pipe, args=(client_sock, upstream), daemon=True).start()
    threading.Thread(target=pipe, args=(upstream, client_sock), daemon=True).start()


server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind((LISTEN_HOST, LISTEN_PORT))
server.listen(128)
print(f'listening on {LISTEN_HOST}:{LISTEN_PORT} -> {TARGET_HOST}:{TARGET_PORT}', flush=True)

while True:
    client, _ = server.accept()
    threading.Thread(target=handle, args=(client,), daemon=True).start()
