The Python websocket server is based on:
https://github.com/dpallot/simple-websocket-server

Refer to "TLS/SSL" example section for setup.
For step 2, add --key to the end:
python SimpleExampleServer.py --example chat --ssl 1 --cert ./cert.pem --key ./cert.pem

Use the following command to convert files from python 2 to 3.
2to3 -w SimpleHTTPServer.py

The full steps are:
=====
An alternative to step 2 and 3 is enable:
chrome://flags/#allow-insecure-localhost
=====

1. Generate a certificate with key:

cert_gen.sh

2. Offer the certificate to the browser by serving websocket.html through https.
The HTTPS server will look for cert.pem in the local directory.
Ensure the websocket.html is also in the same directory to where the server is run.

sudo python ./eg/SimpleHTTPSServer.py

Open a web browser to: https://localhost:443/websocket.html

Click on "advance" to accept the risk.

3. Run the secure TSL/SSL server (in this case the cert.pem file is in the same directory)

python SimpleExampleServer.py --example echo --ssl 1 --cert ./cert.pem --key ./cert.pem

Paste jscode.js into console to test it out. Should return "test".
