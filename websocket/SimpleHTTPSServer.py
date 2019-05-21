'''
The MIT License (MIT)
Copyright (c) 2013 Dave P.
'''

import http.server, http.server
import ssl

# openssl req -new -x509 -days 365 -nodes -out cert.pem -keyout cert.pem
httpd = http.server.HTTPServer(('', 443), http.server.SimpleHTTPRequestHandler)
httpd.socket = ssl.wrap_socket(httpd.socket, server_side=True, certfile='./cert.pem', keyfile='./cert.pem', ssl_version=ssl.PROTOCOL_TLSv1)
httpd.serve_forever()
