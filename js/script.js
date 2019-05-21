//this makes sure that our code will work on different browsers
var RTCPeerConnection = window.webkitRTCPeerConnection;

//Firebase credentials 
/*var config = {
  apiKey: "AIzaSyCgU3Qtc1wnbIH06xQguGpXF4cQlyCxB_I",
  authDomain: "webrtcserver-b814a.firebaseapp.com",
  databaseURL: "https://webrtcserver-b814a.firebaseio.com",
  projectId: "webrtcserver-b814a",
  storageBucket: "webrtcserver-b814a.appspot.com",
  messagingSenderId: "481561492296"
};*/

// switch project for additional quota
var config = {
  apiKey: "AIzaSyAjyh0rJhNGRu9FsmTK_lWPDK252Dp0h7M",
  authDomain: "webrtcautotest.firebaseapp.com",
  databaseURL: "https://webrtcautotest.firebaseio.com",
  projectId: "webrtcautotest",
  storageBucket: "webrtcautotest.appspot.com",
  messagingSenderId: "962823314946"
};

firebase.initializeApp(config);

var enable_video = true;
var enable_audio = true;
var database = firebase.database().ref();
//var friendsVideo = document.getElementById("friendsVideo");
var yourId = Math.floor(Math.random()*1000000000);
var servers = {'iceServers': [{'url': 'stun:stun.services.mozilla.com'}, {'url': 'stun:stun.l.google.com:19302'}, 
               {'url': 'turn:numb.viagenie.ca','credential': 'websitebeaver','username': 'websitebeaver@email.com'}]};
var pc = new RTCPeerConnection(servers);
pc.onicecandidate = (event => event.candidate?sendMessage(yourId, JSON.stringify({'ice': event.candidate})):
                     console.log("Sent All Ice") );
//pc.onaddstream = (event => friendsVideo.srcObject = event.stream);
pc.onaddstream = (event => document.getElementById("friendsVideo").srcObject = event.stream);

function sendMessage(senderId, data) {
    var msg = database.push({ sender: senderId, message: data });
    msg.remove();
}

function readMessage(data) {
    var sender = data.val().sender;
    if (sender != yourId) {
        //console.log("MyID: ", yourId, "Remote ID: ",sender);
        if (sender[0] == 's' || sender[0] == 'g') return; // discard all stats report 
        if (sender[0] == 'b') {
          console.log(sender); // log 'b' report
          console.log(data.val().message);
          if (sender.slice(1, sender.length) == yourId) {
            updateBW(data.val().message);
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
  navigator.mediaDevices.getUserMedia({audio: enable_audio, video: { width: { exact: 640 }, height: { exact: 480 } } })
    .then(stream => yourVideo.srcObject = stream)
    .then(stream => pc.addStream(stream)).catch(e=>console.error(e));
}

function showFriendsFace() {
  pc.createOffer()
    .then(offer => pc.setLocalDescription(offer) )
    .then(() => sendMessage(yourId, JSON.stringify({'sdp': pc.localDescription})));
}


// show stats every xxx ms
// decreased to 3000ms
var statsInterval = setInterval(getStats, 3000);
function getStats(){
  var mreport = [];
  
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
  var name_index = {};
  var googStats = {};
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
  
  sendMessage( 's'.concat(window.yourId), JSON.stringify(mreport) + '$' + JSON.stringify(googStats) );
  })
}

function updateBW(bandwidth){
  pc.createOffer()
  .then(function(offer) {
    return pc.setLocalDescription(offer);
  })
  .then(function() {
    var desc = {
      type: pc.remoteDescription.type,
      sdp: bandwidth === 'unlimited'
          ? removeBandwidthRestriction(pc.remoteDescription.sdp)
          : updateBandwidthRestriction(pc.remoteDescription.sdp, bandwidth)
    };
    console.log('Applying bandwidth restriction to setRemoteDescription:\n');
    return pc.setRemoteDescription(desc);
  })
  .catch(onSetSessionDescriptionError);
}

function onSetSessionDescriptionError(error) {
  console.log('Failed to set session description: ' + error.toString());
}

function updateBandwidthRestriction(sdp, bitrate) {
    var bitratePrefix = navigator.userAgent.indexOf("Firefox") === -1 ? "AS" : "TIAS";
    var media = 'video';
    var lines = sdp.split("\n");
    var line = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf("m="+media) === 0) {
        line = i;
        break;
      }
    }
    if (line === -1) {
      return sdp;
    }
    while(lines[line].indexOf("m="+media) === 0 ||
          lines[line].indexOf("i") === 0 ||
          lines[line].indexOf("c") === 0) {
            line++;
    }
  
    if (lines[line].indexOf("b") === 0) {
      lines[line] = "b="+bitratePrefix+":"+bitrate;
      return lines.join("\n");
    }
  
    var newLines = lines.slice(0, line)
    newLines.push("b=AS:"+bitrate);
    newLines = newLines.concat(lines.slice(line, lines.length));
    return newLines.join("\n");
  }

function removeBandwidthRestriction(sdp) {
  return sdp.replace(/b=AS:.*\r\n/, '').replace(/b=TIAS:.*\r\n/, '');
}
