// Configure Cognito identity pool
AWS.config.region = 'ap-southeast-2';
var credentials = null;

// MQTT client
var client = null;

// Track which IOT topic we are subscribing to
var iotEndpoint = 'a10tf5zm7c6gtp.iot.ap-southeast-2.amazonaws.com';
var iotRegion = 'ap-southeast-2';


var TOPIC_NAME = null;

function connect(topicName) {

    if (credentials === null) {
        console.log("Logging in with an anonymous login");
            credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: 'ap-southeast-2:45dcf6f7-3df4-4375-bd32-ff18b8b1d03d'
            });
    }
    
    
    // Getting AWS creds from Cognito is async, so we need to drive the rest of the mqtt client initialization in a callback
    credentials.get(function(err) {
        console.log("Got credentials from cognito");
        if(err) {
            console.log("ERROR getting credentials");
            console.log(err);
            return;
        }
        console.log("About to make call to getSignedUrl");
        var requestUrl = SigV4Utils.getSignedUrl(iotEndpoint, iotRegion, credentials);
        console.log("Completed call to getSignedUrl")
        // Now that we have the credentials and a signed websocket connect message, connect.
        initClient(topicName, requestUrl);
    });
}

function disconnect() {
    if (client === null || TOPIC_NAME === null || credentials === null) {
        return;
    }
    
    client.disconnect();
}

// Connect the client, subscribe to the drawing topic, and publish a "hey I connected" message
function initClient(topicName, requestUrl, remainingConnectAttemptCount) {
    console.log("Entered initClient")
    // First, disconnect if we already are connected.
    if (client !== null) {
        disconnect();
    }
    
    var clientId = credentials.identityId;
    console.log("Cognito Identity IS " + clientId);
    var newClient = new Paho.MQTT.Client(requestUrl, clientId);
    var connectOptions = {
        onSuccess: function () {
            if (AWS && AWS.config && credentials && credentials.identityId) {
                console.log('Connected with ' + credentials.identityId + ' to ' + iotEndpoint);
            }

            console.log('connected');
            
            // Set global variables with the mqtt client and the topic name
            TOPIC_NAME = topicName;
            client = newClient;
            
            // subscribe to the topic state
            client.subscribe('$aws/things/' + topicName + '/shadow/update/accepted');
            console.log('Subscribed to $aws/things/' + topicName + '/shadow/update/accepted');


        },
        useSSL: true,
        timeout: 10,
        mqttVersion: 4,
        onFailure: function () {
            console.log("Connect failed!");
        }
    };
    
    console.log("About to call Paho.MQTT.Client.connect");
    newClient.connect(connectOptions);
    console.log("Completed call to Paho.MQTT.Client.connect");

    newClient.onConnectionLost = function (message) {
        console.log("connection lost!");
        console.log(message);
        
        if (remainingConnectAttemptCount > 0) {
            initClient(topicName, requestUrl, --remainingConnectAttemptCount);
        }
    };
    newClient.onMessageArrived = function (message) {
        console.log("Entered onMessageArrived");
        try {
            console.log("msg arrived on " + message.destinationName + ": " +  message.payloadString);
            
            var doorstatus = JSON.parse(message.payloadString);
            
            if (message.destinationName === '$aws/things/' + topicName + '/shadow/update/accepted') {
                console.log("Woo Hoo, about to process message")
                //update door div
              	console.log(doorstatus);
              	// doorstatus = { "state": { "reported": {"registeredOwner":"Ravioli Banana","doorState":"open"}, "desired":null }}
                // doorstatus = {"state":{"reported":{"DoorSensor":"Open","macAddress":"b8:27:eb:df:63:5b","location":{"latitude":-37.8103,"longitude":144.9544}}},"metadata":{"reported":{"DoorSensor":{"timestamp":1510295640},"macAddress":{"timestamp":1510295640},"location":{"latitude":{"timestamp":1510295640},"longitude":{"timestamp":1510295640}}}},"version":682,"timestamp":1510295640}  
                document.getElementById('divDoorStatus').innerHTML = "The door is " + doorstatus.state.reported.DoorSensor;
        		console.log("Door state: " + doorstatus.state.reported.DoorSensor);
        		console.log("Home of: " + doorstatus.state.reported.registeredOwner);
          		document.getElementById('divHomeOf').innerHTML = "Home of: " + doorstatus.state.reported.registeredOwner; 
          		if (doorstatus.state.reported.DoorSensor == "open") {
          			console.log("processing door open status");
               		document.getElementById('imgDoor').src = "images/door-open.png";
               		document.getElementById('imgDiscoBall').src = "images/disco-animated.gif";
           		}
           		else {
           			console.log("processing door closed status");
               		document.getElementById('imgDoor').src = "images/door-closed.png";
               		document.getElementById('imgDiscoBall').src = "";
           		}
            } else {
                console.log("Unexpected message: " + message.destinationName)
            }
            
        } catch (e) {
            console.log("error! " + e);
        }
        
    };
    
}


function init(topicName) {
    connect(topicName);
}




