let latestCommands: { [key: string]: number } = {}

let mode: number = null;

const modeToButton: { [key: number]: number } = {
    0: 1,
    1: 2,
    2: 5,
};

let minDistance = 10;
let maxDistance = 50;
let rotationSpeed = -15;
let rotationDuration = 0;
let signalFrequency = 0;
let sonarStopRotationTime = 0;
let distanceSemplingTime = 500;
let sendQueue: string[] = []
let sendMode = 1;
let lastSignalTime = 0;

let dataAngle = 3
let sweepAngle = 3
let lastDataAngle = 0;
let lastSweepAngle = 0;

let volumeMode = false;
let volume = 50;
let noteFrequency = 261;

music.setVolume(50)
basic.clearScreen()
bluetooth.startUartService()

bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let command = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    let commadParts = command.split("=")

    latestCommands[commadParts[0]] = parseFloat(commadParts[1])
})


function send(message: string) {
    if (sendMode == 0) {
        bluetooth.uartWriteLine(message)
    } else {
        sendQueue.push(message)
    }
}

function switchMode(newMode: number = null) {
    if (modeToButton[mode]) {
        send('vc;b;' + modeToButton[mode] + ';1;0;')
    }

    if (mode !== newMode) {
        mode = newMode
        if (modeToButton[newMode]) {
            send('vc;b;' + modeToButton[newMode] + ';1;1;')
        }
    } else {
        mode = null
    }
}

function stop() {
    wuKong.setServoSpeed(wuKong.ServoList.S0, 0)
    switchMode()
}


basic.forever(function () {
    while (Object.keys(latestCommands).length) {
        let commandName = Object.keys(latestCommands)[0]
        let commandValue = latestCommands[commandName]
        delete latestCommands[commandName];

        if (commandName == "-v") {
            wuKong.setServoSpeed(wuKong.ServoList.S0, 0)

            // send('vc;import_start;')
            send('vc;init;')
            send('vc;sl;0;130;987;1;0;0;0;261;')
            send('vc;sr;1;-100;100;1;0;0;0;;')
            send('vc;b;1;1;0;<i class="fa-solid fa-car-side"></i>;')
            send('vc;b;2;1;0;<i class="fa-solid fa-satellite-dish"></i>;')
            send('vc;b;5;1;0;<i class="fa-solid fa-clock-rotate-left"></i>;')
            send('vc;b;3;1;0;<i class="fa-solid fa-volume-high"></i>;')
            send('vc;b;4;1;0;<i class="fa-solid fa-play"></i>;')
            send('vc;il;1;')
            send('vc;ir;1;')
            send('vc;show;sl,sr,br,bl;')
            // send('vc;import_end;')
        } else if (commandName == "sl") {
            if (volumeMode) {
                volume = commandValue
                music.setVolume(commandValue)
            } else {
                noteFrequency = commandValue
            }
        } else if (commandName == "sr") {
            wuKong.setServoSpeed(wuKong.ServoList.S0, commandValue)
        } else if (commandName == "1") {
                switchMode(0)
        } else if (commandName == "2") {
                if (mode != 1) {
                    if (rotationDuration) {
                        send('vc;m;')
                        send('clearData')
                        switchMode(1)
                    } else {
                        send('alert;Rotation time is not set!')
                        send('vc;m;Not set!')
                    }
                } else {
                    stop()
                }
        } else if (commandName == "5") {
                switchMode(2)
        } else if (commandName == "rotationSpeed") {
            rotationSpeed = commandValue
        } else if (commandName == "maxDistance") {
            maxDistance = commandValue
        } else if (commandName == "sendMode") {
            sendMode = commandValue
        } else if (commandName == "dataAngle") {
            dataAngle = commandValue
        } else if (commandName == "sweepAngle") {
            sweepAngle = commandValue
        } else if (commandName == "musicVolume") {
            volume = commandValue
            music.setVolume(commandValue)
        } else if (commandName == "stop") {
            switchMode()
            stop()
        } else if (commandName == "dstime") {
            distanceSemplingTime = commandValue
        } else if (commandName == "3") {
            volumeMode = !volumeMode

            if (volumeMode) {
                send('vc;b;3;1;1;')
                send(`vc;sl;0;0;255;1;0;0;0;${volume};`)
                // send(`vc;slv;${volume};`)
            } else {
                send('vc;b;3;1;0;')
                send(`vc;sl;0;130;987;1;0;0;0;${noteFrequency};`)
                // send(`vc;slv;${noteFrequency};`)
            }
        } else if (commandName == "4") {
            music.playTone(noteFrequency, 1000)
        } else if (commandName == "rt") {
            rotationDuration = commandValue
        }
    }
})

// Queue
basic.forever(function () {
    while(sendQueue.length) {
        bluetooth.uartWriteLine(sendQueue.shift())
        basic.pause(20)
    }
})

basic.forever(function () {
    if (mode == 0 && signalFrequency) {
        if (input.runningTime() - lastSignalTime - signalFrequency > 0) {
            music.play(music.tonePlayable(Note.C, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
            lastSignalTime = input.runningTime()
        }
    }
})

basic.forever(function () {
    if (mode == 0) {
        // Car beep

        while(mode == 0) {
            let distance = sonar.ping(DigitalPin.P0, DigitalPin.P1, PingUnit.Centimeters)

            if (distance > 0 && distance < maxDistance) {
                signalFrequency = 25 * distance - 300
                send([input.runningTime(), distance].join(','))
            } else {
                signalFrequency = 0
                send([input.runningTime(), 0].join(','))
            }

            basic.pause(distanceSemplingTime)
        }
    } else if (mode == 1 && rotationDuration) {
        // Sonar
        let rotationTime = 0;
        
        wuKong.setServoSpeed(wuKong.ServoList.S0, rotationSpeed)

        let sonarStartTime = input.runningTime()

        while (mode == 1) {
            let distance = sonar.ping(DigitalPin.P0, DigitalPin.P1, PingUnit.Centimeters)
            rotationTime = input.runningTime() - sonarStartTime
            let angle = ((rotationTime + sonarStopRotationTime) % rotationDuration) * 360 / rotationDuration

            let angleCounter = angle - lastDataAngle;
            if (angleCounter < 0) {
                angleCounter = 360 + angleCounter;
            }

            let angleSweepCounter = angle - lastSweepAngle;
            if (angleSweepCounter < 0) {
                angleSweepCounter = 360 + angleSweepCounter;
            }

            if (distance > 0 && distance < maxDistance && angleCounter >= dataAngle) {
                send([input.runningTime(), distance, angle].join(','))
                lastDataAngle = angle
            } else if (angleSweepCounter >= sweepAngle) {
                send([input.runningTime(), 0, angle].join(','))
                lastSweepAngle = angle
            }

            basic.pause(20)
        }

        sonarStopRotationTime = rotationTime + sonarStopRotationTime
    } else if (mode == 2) {
        let startTime: number = 0;
        let endTime: number = 0;

        wuKong.setServoSpeed(wuKong.ServoList.S0, rotationSpeed)
        let trigger = true;

        while (mode == 2 && (!startTime || !endTime)) {
            let distance = sonar.ping(DigitalPin.P0, DigitalPin.P1, PingUnit.Centimeters)

            if (distance > 0 && distance < 1000) {
                if (distance > 0 && distance < 10) {
                    if (!trigger) {
                        if (!startTime) {
                            startTime = input.runningTime()
                        } else {
                            endTime = input.runningTime()
                        }

                        trigger = true
                    }
                } else {
                    trigger = false
                }
            }

            basic.pause(20)
        }

        wuKong.setServoSpeed(wuKong.ServoList.S0, 0)

        rotationDuration = endTime - startTime

        send('rotation;' + rotationDuration)
        send('vc;m;' + rotationDuration)
        switchMode()
    }
})