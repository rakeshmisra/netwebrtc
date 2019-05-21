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

var enable_video = true;
var enable_audio = false;
var database = firebase.database().ref();
var storageRef = firebase.storage().ref();
var storage = firebase.app().storage("gs://netwebrtc.appspot.com");
var storageRef = storage.ref();

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
pc.onicecandidate = (event => event.candidate?sendMessage(yourId, JSON.stringify({'ice': event.candidate})):
                     console.log("Sent All Ice") );
//pc.onaddstream = (event => friendsVideo.srcObject = event.stream);
pc.onaddstream = (event => document.getElementById("friendsVideo").srcObject = event.stream);


// === Automated tasks defined here ===
// get role: desktop/mobile
//var role = null
var all_message = ""  //getStats() will add stats to all_message
// Desktop automatically connect to mobile after N seconds
if (role == "desktop") {
  console.log("Start videoconf in 8 seconds.")
  setTimeout( function() { showFriendsFace(); }, 8000) }

// Automatically upload all stats after 100+N seconds (N seconds extra to ensure completeness of data)
var file_path = "/" + role + "/" + yourId.toString() + ".txt"   
var ref = storageRef.child(file_path)
setTimeout( function() {
ref.putString(all_message).then(function(snapshot) {
  console.log('Uploaded stats!');}); 
}, 140000 ) // ms


function sendMessage(senderId, data) {
    var msg = database.push({ sender: senderId, message: data });
    msg.remove();
}

function readMessage(data) {
    var sender = data.val().sender;
    if (sender != yourId) {
        //console.log("MyID: ", yourId, "Remote ID: ",sender);
        if (sender[0] == 's' || sender[0] == 'g') return; // discard all stats report 
        if (sender[0] == 'b' || sender[0] == 'c') {
          console.log(sender); // log the report
          console.log(data.val().message);
          if (sender.slice(1, sender.length) == yourId) {
            if (sender[0] == 'b')
              updateBW(data.val().message);
            else if (sender[0] == 'c')
              limitResolution(data.val().message);
          }
          return; 
        }

        var msg = JSON.parse(data.val().message);
        if (msg.ice != undefined)
            pc.addIceCandidate(new RTCIceCandidate(msg.ice));
        else if (msg.sdp.type == "offer"){
            pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
              .then(() => pc.createAnswer())
              .then(answer => pc.setLocalDescription(answer))
              .then(() => sendMessage(yourId, JSON.stringify({'sdp': pc.localDescription})));}
        else if (msg.sdp.type == "answer")
        {
           pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        }
    }
};

database.on('child_added', readMessage);

function muteAudio(){
  enable_audio = false;
}

function muteVideo(){
  enable_video = false;
}

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
    .then(() => sendMessage(yourId, JSON.stringify({'sdp': pc.localDescription})));
}


// show stats every xxx ms
var current_report = ""  // all current stringified report
var mreport = []; // webrtc report
var name_index = {};
var googStats = {};  // google specific stats
var selected_stats = {};  // selected stats such as RTT, current delay, etc.
var send_kpi = ['timestamp', 'googRtt', 'packetsLost', 'packetsSent', 'googAvailableSendBandwidth',
                'googTargetEncBitrate', 'googActualEncBitrate', 'googTransmitBitrate'];
var recv_kpi = ['timestamp', 'googCurrentDelayMs', 'packetsLost', 'packetsReceived', 'framesDecoded', 
                'googInterframeDelayMax', 'googJitterBufferMs', 'googPlisSent',
                'googFrameWidthReceived', 'googFrameHeightReceived'];
var statsInterval = setInterval(getStats, 200);  // ms
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
  // send all to storage rather than send to database frequently
  //sendMessage( 's'.concat(window.yourId), JSON.stringify(mreport) + '$' + JSON.stringify(googStats) );
  current_report = 's'.concat(window.yourId) + '$' + JSON.stringify(mreport) + '$' + JSON.stringify(googStats)
  all_message += current_report + "\r\n";

  // extract useful stats
  var kpi = [];
  if(role == "desktop") kpi = send_kpi; else kpi = recv_kpi;
  // init empty stats
  if(selected_stats[kpi[0]] == undefined)
      for(i=0;i<kpi.length;i++) selected_stats[kpi[i]] = [];
  // all stats comes from googStats, except for the first one
  selected_stats[kpi[0]].push( new Date().getTime() % 100000); // only use xx.xxx seconds
  for(i=1;i<kpi.length;i++) selected_stats[kpi[i]].push( googStats[kpi[i]] );
  // send stats when lenght reach N
  sendMessage( 's'.concat(window.yourId) + "_" + role, JSON.stringify(selected_stats) ); 
  /*
  if( selected_stats[kpi[0]].length >= 5 ) { 
    sendMessage( 's'.concat(window.yourId) + "_" + role, JSON.stringify(selected_stats) ); 
    selected_stats = {}; // clear selected_stats
  }*/
 })
}

// updateBW in kbps
function updateBW(min_bandwidth, max_bandwith = 0){
  if(max_bandwith < 1) max_bandwith = min_bandwidth;
  pc.createOffer()
  .then(function(offer) {
    return pc.setLocalDescription(offer);
  })
  .then(function() {
    var desc = {
      type: pc.remoteDescription.type,
      sdp: min_bandwidth === 'unlimited'
          ? removeBandwidthRestriction(pc.remoteDescription.sdp)
          : updateBandwidthRestriction(pc.remoteDescription.sdp, min_bandwidth, max_bandwith)
    };
    console.log('Applying bandwidth restriction to setRemoteDescription:\n');
    return pc.setRemoteDescription(desc);
  })
  .catch(onSetSessionDescriptionError);
}

function onSetSessionDescriptionError(error) {
  console.log('Failed to set session description: ' + error.toString());
}

var new_sdp = "";
function updateBandwidthRestriction(sdp, min_bitrate, max_bitrate) {
  new_sdp = sdp;
  if(typeof(min_bitrate) === "number") min_bitrate = JSON.stringify(min_bitrate);
  if(typeof(max_bitrate) === "number") max_bitrate = JSON.stringify(max_bitrate);
  new_sdp = setCodecParam(new_sdp, "VP8/90000", "x-google-min-bitrate", min_bitrate);
  new_sdp = setCodecParam(new_sdp, "VP9/90000", "x-google-min-bitrate", min_bitrate);
  new_sdp = setCodecParam(new_sdp, "VP8/90000", "x-google-max-bitrate", max_bitrate);
  new_sdp = setCodecParam(new_sdp, "VP9/90000", "x-google-max-bitrate", max_bitrate);
  console.log(new_sdp);
  return new_sdp;
}

/*function removeBandwidthRestriction(sdp) {
  return sdp.replace(/b=AS:.*\r\n/, '').replace(/b=TIAS:.*\r\n/, '');
}*/

// not tested
function removeBandwidthRestriction(sdp) {
  new_sdp = sdp;
  new_sdp = setCodecParam(new_sdp, "VP8/90000", "x-google-min-bitrate", "30");
  new_sdp = setCodecParam(new_sdp, "VP9/90000", "x-google-min-bitrate", "30");
  new_sdp = setCodecParam(new_sdp, "VP8/90000", "x-google-max-bitrate", "100000");
  new_sdp = setCodecParam(new_sdp, "VP9/90000", "x-google-max-bitrate", "100000");
  return new_sdp;
}

// apply resolution limit
function limitResolution(c_msg){
  var myWidth = parseInt( c_msg.split('.')[0] )
  var myHeight = parseInt( c_msg.split('.')[1] )
  var myFramerate = parseInt( c_msg.split('.')[2] )
  var c = { width: {min: myWidth, max: myWidth}, 
            height: {min: myHeight, max: myHeight}, 
            frameRate: {min: 3, max: 3}
          }
  yourVideo.srcObject.getVideoTracks()[0].applyConstraints(c)
}

/*
// secure web socket for communicate with python local host
if (role == "desktop"){
  var sk = new WebSocket("wss://localhost:8000/");
  var sk_is_open = false;
  sk.onopen = function (event) {
    //sk.send("Test"); 
    sk_is_open = true;
  };
  
  // send report periodically
  var wssInterval = setInterval(send_wss, 200);
  function send_wss(){
    if(sk_is_open) sk.send(current_report);  // send message after socket is open
  }

  sk.onmessage = function (event) {
    console.log("Changing bitrate to: " + event.data);
    updateBW(parseInt(event.data))
  }
  //sk.close();
}
*/
