var exampleSocket = new WebSocket("wss://localhost:8000/");
exampleSocket.onopen = function (event) {
  exampleSocket.send("Test"); 
};
exampleSocket.onmessage = function (event) {
  console.log(event.data);
  exampleSocket.close();
}



