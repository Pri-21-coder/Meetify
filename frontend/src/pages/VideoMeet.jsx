import React, { useEffect,useRef,useState } from 'react';
import io from "socket.io-client";
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';
import styles from "../styles/videoComponent.module.css"
const server_url = "http://localhost:8000";
var connections = {};
const peerConfigConnections = {
    "iceServers": [
        {"urls": "stun:stun.l.google.com:19302"}
    ]
}
export default function VideoMeetComponent(){
    // We will handle WebRTC connections state
    var socketRef = useRef();
    let socketIdRef = useRef();
    //localVideoRef initialize with nothing
    let localVideoRef = useRef();
    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState([]);
    let [audio, setAudio] = useState();
    let [screen, setScreen] = useState();
    let [showModal, setModal] = useState();
    let [screenAvailable, setScreenAvailable]= useState();
    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);
    //for guest user
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");
    const videoRef = useRef([]);
    let [videos, setVideos] = useState([])
    
    useEffect(()=>{
        getPermissions();
    }, [])

   
    const getPermissions = async() => {
        try {
            //take permission if we can use your camera or not (navigator is important)
            const videoPermission = await navigator.mediaDevices.getUserMedia({video: true});
            // if give permission
            if(videoPermission){
                setVideoAvailable(true);
            }
            else{
                setVideoAvailable(false);
            }
            // writting same things for audio
            const audioPermission = await navigator.mediaDevices.getUserMedia({audio: true});
            // if give permission
            if(audioPermission){
                setAudioAvailable(true);
            }
            else{
                setAudioAvailable(false);
            }
            // to on the screen sharing
            // to show screen we don't need permission
            if(navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            }
            else{
                setScreenAvailable(false);
            }
            if(videoAvailable || audioAvailable){
                // these stream send to client using WEBRTC and also accept stream
                const userMediaStream = await navigator.mediaDevices.getUserMedia({video: videoAvailable, audio: audioAvailable});
                //if we have media stream
                if(userMediaStream){
                    window.localStream = userMediaStream;
                    if(localVideoRef.current) {
                        // stream initialize in the video source object
                        localVideoRef.current.srcObject = userMediaStream;
                    }
                    
                }
            }
        }catch(err) {
            console.log(err)
        }
    }
    // this is the dependency useEffect
    useEffect(()=>{
        if(video !== undefined && audio !== undefined){
            getUserMedia();

        }
    }, [audio, video])
    let getMedia = ()=>{
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        // after run previous two line do getAudio function should be run
        // setVideo, setAudio asynchronous function thats why need dependency use-effect
        connectToSocketServer();
    }
    // This function is responsible for if I stopped my video then all other computers in the meeting my video should be stopped
    let getUserMediaSuccess = (stream)=>{
        try{
            window.localStream.getTracks().forEach(track => track.stop())
        }catch(e) {
            console.log(e)
        }
        // new stream initialize
        window.localStream = stream;
        //if video off we can't see any video
        localVideoRef.current.srcObject = stream;
        for(let id in connections){
            if(id === socketIdRef.current) continue;
            connections[id].addStream(window.localStream)
            connections[id].createOffer().then((description)=>{
                connections[id].setLocalDescription(description)
                .then(()=>{
                    socketRef.current.emit("signal", id, JSON.stringify({"sdp": connections[id].localDescription}))
                })
                .catch(e => console.log(e))
            })
        }
        // this stream comes from getUserMedia
        // when track ended need to stop video audio and show blacksilence
        stream.getTracks().forEach(track => track.onended =()=>{
            setVideo(false);
            setAudio(false);
            try{
                let tracks = localVideoRef.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch(e){
                console.log(e)
            }
            //need to create blacksilence
            let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence();
            localVideoRef.current.srcObject = window.localStream; 
            for(let id in connections){        
                connections[id].addStream(window.localStream)
                connections[id].createOffer().then((description)=>{
                    connections[id].setLocalDescription(description)
                    .then(()=>{
                        socketRef.current.emit('signal', id, JSON.stringify({'sdp': connections[id].localDescription}))
                    }).catch(e => console.log(e));
                })
            }
    })
    
    }
    
    // if we mute audio should be gone if video stop then video not going to appear
    let getUserMedia = () =>{
        if((video && videoAvailable) || (audio && audioAvailable)){
            // we are in main video call feature not lobby ( we are in connect) current video state
            navigator.mediaDevices.getUserMedia({video: video, audio: audio})
            .then(getUserMediaSuccess) // getUserMediaSuccess
            .then((stream)=>{})
            .catch((e)=> console.log(e))
        }
        else{
            try{
                let tracks= localVideoRef.current.srcObject.getTracks();
                tracks.forEach(track =>track.stop())
            }catch(e){
                console.log(e)
            }
        }
    }
    

    // difficult part
    let gotMessageFromServer =(fromId, message)=>{
        //if signal comes transfer to this
        var signal = JSON.parse(message)
        // I don't send message to me
        if(fromId !== socketIdRef.current){
            if(signal.sdp){
                // take the sended session description and read it
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(()=>{
                    if(signal.sdp.type === "offer"){
                        connections[fromId].createAnswer().then((description)=>{
                            connections[fromId].setLocalDescription(description).then(()=>{
                                // sent signal we accept your offer, now we can talk through stun server
                                socketRef.current.emit("signal", fromId, JSON.stringify({"sdp": connections[fromId].localDescription}))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }
            // if signal is the initial connection
            if(signal.ice){
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
            }  
        }
    }
    let addMessage = ()=>{

    }
    let connectToSocketServer = ()=>{
        socketRef.current = io.connect(server_url, {secure: false})
        //catch server emit message
        socketRef.current.on('signal', gotMessageFromServer);
        socketRef.current.on("connect", ()=>{
            // send the emit message to server
            socketRef.current.emit("join-call", window.location.href)
            socketIdRef.current = socketRef.current.id
            socketRef.current.on("chat-message", addMessage)
            socketRef.current.on("user-left", (id)=>{
                setVideos((videos)=> videos.filter((video)=>video.socketId !== id))
            })
            socketRef.current.on("user-joined",(id,clients)=>{
                clients.forEach((socketListId)=>{
                    
                    // use webRTC
                    connections[socketListId]= new RTCPeerConnection(peerConfigConnections)
                    // ice is actually a protocol interactive connectivity establishment
                    // use to connect directly one client to another
                    connections[socketListId].onicecandidate = (event) => {
                        if(event.candidate !== null){
                            socketRef.current.emit("signal", socketListId, JSON.stringify({'ice': event.candidate}))
                        }
                    }
                    connections[socketListId].onaddstream = (event)=>{
                        // video stream only, audio stream only, audio video both stream, screen share stream all can comes
                        // diff diff stream
                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);
                        if(videoExists){
                            setVideos(Videos =>{
                                const updatedVideos = videos.map(video =>
                                    // socketId not match means stream comes from diff people we don't need that in this else condition comes
                                    video.socketId === socketListId ? { ...video, stream: event.stream}: video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            })
                        }else{
                            let newVideo = {
                                socketId: socketListId,
                                stream: event.stream,
                                autoPlay: true,
                                playsInline: true
                            }
                            setVideos(videos =>{
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current= updatedVideos;
                                return updatedVideos;
                            });
                        }
                    };
                    // because of window extension accesible everywhere
                    if(window.localStream !== undefined && window.localStream !== null){
                        connections[socketListId].addStream(window.localStream);
                    } else{
                        // if we stop video then blackSlience comes. blackScreen comes through media context
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
                        window.localStream = blackSilence();
                        connections[socketListId].addStream(window.localStream);

                    }
                })
                //my connection
                if(id===socketIdRef.current){
                    for(let id2 in connections){
                        //we don't need to establish connection with own
                        if(id2 === socketIdRef.current) continue
                        // other wise try to add my local stream in connection id2
                        try{
                            connections[id2].addStream(window.localStream)
                        }catch(e){
                            console.log(e)
                        }
                        connections[id2].createOffer().then((description)=>{
                            connections[id2].setLocalDescription(description)
                            .then(()=>{
                                // sdp means session description protocol (need for connection establish)
                                socketRef.current.emit("signal", id2, JSON.stringify({"sdp": connections[id2].localDescription}))
                            })
                            .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    };
    //Silence function for audio
    let silence=()=>{
        let ctx = new AudioContext();
        // for frequency
        let oscillator = ctx.createOscillator();
        let dst = oscillator.connect(ctx.createMediaStreamDestination());
        oscillator.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], {enabled: false})
    }
    // black function for black screen
    let black =({width= 640, height= 480}={}) =>{
        let canvas = Object.assign(document.createElement("canvas"), {width, height});
        canvas.getContext('2d').fillRect(0,0,width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], {enabled: false});
    }
    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }
    return(
        <div>
            {askForUsername === true ?
                <div>
                    <h2>Enter into Lobby</h2>
                    <TextField id="outlined-basic" label="Username" value={username} onChange={e =>setUsername(e.target.value)} variant="outlined"/>
                        <Button variant="contained" onClick={connect}>Connect</Button>
                        <div>
                            <video ref={localVideoRef} autoPlay muted></video>
                        </div>
                </div> : 
                <div className={styles.meetVideoContainer}>
                {/* autoPlay use for show the video */}
                    <video className= 'meetUserVideo' ref={localVideoRef} autoPlay muted></video>
                    {/* for connecting people */}
                    {videos.map((video)=>(
                        <div key={video.socketId}>
                            <h2>{video.socketId}</h2>
                            <video
                                data-socket={video.socketId}
                                ref={ref => {
                                    if (ref && video.stream) {
                                        ref.srcObject = video.stream;
                                    }
                                }}
                                autoPlay
                                >
                            </video>
                            
                        </div>
                    ))}
                </div>
            }
        </div>
        )
}