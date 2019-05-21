import signal
import sys
import ssl
import time
from datetime import datetime
from SimpleWebSocketServer import WebSocket, SimpleWebSocketServer, SimpleSSLWebSocketServer
from optparse import OptionParser

class SimpleWSS(WebSocket):
    def handleMessage(self):
        print( str(datetime.now()) )
        print(self.data)
        state = parse_state( self.data )
        action = rl_test(state) 
        self.sendMessage( str(action) ) # send action as string
    
    def handleConnected(self):
        print( str(datetime.now()), self.address, 'connected')

    def handleClose(self):
        print( str(datetime.now()), self.address, 'closed')

def parse_state(s):
    state = s
    return state  

def rl_test(state):
    return "500"
      
if __name__ == "__main__":
    host = ''
    port = 8000
    cert = "./cert.pem"
    key = "./cert.pem"
    ver = ssl.PROTOCOL_TLSv1
    server = SimpleSSLWebSocketServer(host, port, SimpleWSS, cert, key, version=ver)

    def close_sig_handler(signal, frame):
        server.close()
        sys.exit()
    signal.signal(signal.SIGINT, close_sig_handler)
    server.serveforever()
