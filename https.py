# must run with python3
# taken from http://www.piware.de/2011/01/creating-an-https-server-in-python/ 
# generate server.xml with the following command:
#    openssl req -new -x509 -keyout server.pem -out server.pem -days 365 -nodes 
#run as follows: python simple-https-server.py 
#then in your browser, visit: https://localhost:4443
import sys
import http.server
import ssl

if len(sys.argv) == 2: 
    port = int( sys.argv[1] )
else:
    port = 4443
print("Serving at port: ", port)
httpd = http.server.HTTPServer(('localhost', port), http.server.SimpleHTTPRequestHandler) 
httpd.socket = ssl.wrap_socket (httpd.socket, certfile='./websocket/cert.pem', server_side=True)
httpd.serve_forever()
