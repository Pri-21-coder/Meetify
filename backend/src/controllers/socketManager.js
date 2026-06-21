import {Server} from "socket.io";
let connections = {}
let messages = {}
let timeOnline = {}
export const connectToSocket =(server) => {
    const io = new Server(server);
    //connect with socket
    io.on("connection", (socket)=>{
        //on means something emit from client side, 
        // it emits something in server to listen in client side we use .on
        socket.on("join-call", (path)=>{
            if(connection[path] == undefined){
                connections[path]=[]
            }
            // one meeting id all the user (inn this way all meeting)
            connections[path].push(socket.id)
            //online time
            timeOnline[socket.id] = new Date();

            //number of server/path
            for(let a=0; a<connections[path].length; i++){
                io.to(connections[path][a]).emit("user-joined", socket.id, connections[path])
            }
            if (message[path] != undefined){
                for(let a=0;a<message[path].length; ++a){
                    io.to(socket.id).emit("chat-message", messages[path][a]['data'],
                        messages[path][a]['sender'], message[path][a]['socket-id-sender'])
                }
            }
        })
        socket.on("signal", (toId, message)=> {
            io.to(toId).emit("signal", socket.id, message);
        })
        // chat message comes from client after press the enter
        socket.on("chat-message", (data,sender)=>{
            //find in which meeting room user are in
            const [matchingRoom, found]= Object.entries(connections)
            .reduce(([room, isFound], [roomKey, roomValue]) =>{
                if(!isFound && roomValue.includes(socket.id)){
                    return [roomKey, true];
                }
                return [room, isFound];
            }, ['', false]);
            if(found == true){
                if(message[matchingRoom] == undefined){
                    messages[matchingRoom] = []
                }
                messages[matchingRoom].push({'sender':sender, "data": data, "socket-id-sender":socket.id})
                console.log("message",Key, ":", sender, data)
                connections[matchingRoom].forEach((elem)=>{
                    io.to(elem).emit("chat-message", data, sender, socket.id)
                })
            }
        })
        socket.on("disconnect", ()=>{
            var diffTime = Math.abs(timeOnline[socket.id] - new Date())
            var Key
            // k->room v->no of person
            for( const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))){
                // iterate with number of person in a meeting room
                for(let a = 0; a< v.length; ++a){
                    //if disconnect person id equal to current socket id
                    //that person would be emit user-left
                    if(v[a] == socket.id){
                        key = k
                        for (let a=0; a< connections[key].length; ++a){
                            io.to(connections[key][a]).emit('user-left', socket.id)
                        }
                        // detele the connection index
                        var index = connections[key].indexOf(socket.id)
                        connections[key].splice(index,1)
                        // if key 0 means room has no client then drop the meeting
                        if(connection[key].length == 0){
                            delete connections[key]
                        }
                    }
                }
            }
        })
    })
    return io;
}
