import socket
from wsgiref.simple_server import WSGIServer, make_server

class ReusePortWSGIServer(WSGIServer):
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
        super().server_bind()

def start_metrics_server(port, app):
    httpd = make_server('', port, app, ReusePortWSGIServer)
    httpd.serve_forever()
