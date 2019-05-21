//this makes sure that our code will work on different browsers
var RTCPeerConnection = window.webkitRTCPeerConnection;

// using  paid plan
var config = {
    apiKey: "AIzaSyDVhw8rhU167ALWQSTK01NnYIijkGr0SdA",
    authDomain: "netwebrtc.firebaseapp.com",
    databaseURL: "https://netwebrtc.firebaseio.com",
    projectId: "netwebrtc",
    storageBucket: "netwebrtc.appspot.com",
    messagingSenderId: "142979039811"
  };

firebase.initializeApp(config);

eval(window.location.search.substring(1));   // eval url string to get roomid
var enable_video = true;
var enable_audio = false;
var database = firebase.database().ref().child(roomid);
var db_signaling = database.child("signaling")
var db_stats = database.child("stats")
var db_control = database.child("control")

function muteAudio(){
  enable_audio = false;
}

function muteVideo(){
  enable_video = false;
}

// handle room creation and join
//var friendsVideo = document.getElementById("friendsVideo");
//var yourId = Math.floor(1e16 +  Math.random()*9e16); // fixed length
// getting id based on role and timestamp
var time_seconds = Math.round(+new Date()/1000);
yourId = Math.round( time_seconds/30 )*30
if (role == "desktop"){
  yourId += 1; // ensure different ids
}
var servers = {'iceServers': [{'url': 'stun:stun.services.mozilla.com'}, {'url': 'stun:stun.l.google.com:19302'}, 
               {'url': 'turn:numb.viagenie.ca','credential': 'websitebeaver','username': 'websitebeaver@email.com'}]};
var pc = new RTCPeerConnection(servers);
pc.onicecandidate = (event => event.candidate?sendSignal(yourId, JSON.stringify({'ice': event.candidate})):
                     console.log("Sent All Ice") );
//pc.onaddstream = (event => friendsVideo.srcObject = event.stream);
pc.onaddstream = (event => document.getElementById("friendsVideo").srcObject = event.stream);

function showMyFace() {
  document.getElementById("p1").innerHTML = "My ID: " + yourId.toString(); // show my ID
  var yourVideo = document.getElementById("yourVideo");
  navigator.mediaDevices.getUserMedia({audio: enable_audio, video: { width: { exact: 1280 }, height: { exact: 720 } } })
    .then(stream => yourVideo.srcObject = stream)
    .then(stream => pc.addStream(stream)).catch(e=>console.error(e));
}

function showFriendsFace() {
  pc.createOffer()
    .then(offer => pc.setLocalDescription(offer) )
    .then(() => sendSignal(yourId, JSON.stringify({'sdp': pc.localDescription})));
}

// === Automated tasks defined here ===
// get role: desktop/mobile
//var role = null
var all_message = ""  //getStats() will add stats to all_message
// Desktop automatically connect to mobile after N seconds
if (role == "desktop") {
  console.log("Start videoconf in 8 seconds.")
  setTimeout( function() { showFriendsFace(); }, 8000) }

// define: sendSignal, sendStats, recvSignal, recvControl and register listener
function sendSignal(senderId, data) {
  var msg = db_signaling.push({ sender: senderId, message: data });
  msg.remove();
}

function sendStats(data) {
  //var msg = db_stats.child(role).push({ message: data });
  //msg.remove();
  var msg = db_stats.child(role).set({ message: data });
}

function recvSignal(data){
  var sender = data.val().sender;
  if (sender != yourId) {
      var msg = JSON.parse(data.val().message);
      if (msg.ice != undefined)
          pc.addIceCandidate(new RTCIceCandidate(msg.ice));
      else if (msg.sdp.type == "offer"){
          pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
            .then(() => pc.createAnswer())
            .then(answer => pc.setLocalDescription(answer))
            .then(() => sendSignal(yourId, JSON.stringify({'sdp': pc.localDescription})));}
      else if (msg.sdp.type == "answer")
      {
         pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      }
  }
}

function recvControl(data){
  console.log(data.val().message);
  limitResolution(data.val().message);
}

db_signaling.on('child_added', recvSignal);
if(role == "desktop") db_control.on('child_added', recvControl);


// show stats every xxx ms
var current_report = ""  // all current stringified report
var mreport = []; // webrtc report
var name_index = {};
var googStats = {};  // google specific stats
var selected_stats = {};  // selected stats such as RTT, current delay, etc.
var send_kpi = ['timestamp', 'googRtt', 'packetsLost', 'packetsSent', 'googAvailableSendBandwidth',
                'googTargetEncBitrate', 'googActualEncBitrate', 'googTransmitBitrate'];
var recv_kpi = ['timestamp', 'bytesReceived', 'googCurrentDelayMs', 'packetsLost', 'packetsReceived', 'framesDecoded', 
                'googInterframeDelayMax', 'googJitterBufferMs', 'googPlisSent',
                'googFrameWidthReceived', 'googFrameHeightReceived'];
var statsInterval = setInterval(getStats, 1000);  // change from 200 to 1000ms
function getStats(){
  mreport = [];
  // get webrtc default stats
  pc.getStats(null).then(function(res) {
    res.forEach(function(report) {
      var str_rep = JSON.stringify(report);
      if(str_rep.includes("RTCInboundRTPVideoStream") ||
         str_rep.includes("RTCMediaStreamTrack_local_video") ||
         str_rep.includes("RTCMediaStreamTrack_remote_video") ||
         str_rep.includes("RTCOutboundRTPVideoStream")
        )
        mreport.push(str_rep);
    })
    //console.log(mreport);
    //sendMessage('s'.concat(yourId), JSON.stringify(mreport));
  })
  // Get google specific reports
  pc.getStats(function callback(connStats){
  var rtcStatsReports = connStats.result() // array of available status-reports
  name_index = {};
  googStats = {};
  // add my own timstamp
  googStats["timestamp"] = new Date().getTime().toString();
  for(var i=0;i<rtcStatsReports.length;i++)
      name_index[i] = rtcStatsReports[i].names();
  for(i=0;i<Object.keys(name_index).length;i++)
      if(rtcStatsReports[i].type == "ssrc") {
          if(rtcStatsReports[i].stat('mediaType') == "video")	
              for(var j=0;j<Object.keys(name_index[i]).length;j++)
                  //console.log(i,name_index[i][j],rtcStatsReports[i].stat(name_index[i][j]));
                  googStats[name_index[i][j]] = rtcStatsReports[i].stat(name_index[i][j]);
      }
      else if (rtcStatsReports[i].type == "VideoBwe") {
        for(var j=0;j<Object.keys(name_index[i]).length;j++)
                  //console.log(i,name_index[i][j],rtcStatsReports[i].stat(name_index[i][j]));
                  googStats[name_index[i][j]] = rtcStatsReports[i].stat(name_index[i][j]);
      }
  current_report = 's'.concat(window.yourId) + '$' + JSON.stringify(mreport) + '$' + JSON.stringify(googStats)
  //all_message += current_report + "\r\n";

  // extract useful stats
  var kpi = [];
  if(role == "desktop") kpi = send_kpi; else kpi = recv_kpi;
  for(i=0;i<kpi.length;i++) selected_stats[kpi[i]] = googStats[kpi[i]];
  sendStats( JSON.stringify(selected_stats) ); 
 })
}

// apply resolution limit
function limitResolution(c_msg){
  var myWidth = parseInt( c_msg.split('.')[0] )
  var myHeight = parseInt( c_msg.split('.')[1] )
  var myFramerate = parseInt( c_msg.split('.')[2] )
  var c = { width: {min: myWidth, max: myWidth}, 
            height: {min: myHeight, max: myHeight}, 
            frameRate: {min: myFramerate, max: myFramerate}
          }
  yourVideo.srcObject.getVideoTracks()[0].applyConstraints(c)
}
