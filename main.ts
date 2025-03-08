let latestCommands: { [key: string]: number } = {}

let mode: number = null;
let lastMode: number = null;

const modeToButton: { [key: number]: number } = {
    0: 1,
    1: 2,
    2: 3,
};

let minDistance = 10;
let maxDistance = 50;
let rotationSpeed = -10;
let rotationDuration = 0;
let signalFrequency = 0;
let sonarStartTime = 0;

music.setVolume(50)


function switchMode(newMode: number) {
    lastMode = newMode
    if (modeToButton[mode]) {
        bluetooth.uartWriteLine('vc;b;' + modeToButton[mode] + ';1;0;')
    }

    if (mode !== newMode) {
        mode = newMode
        bluetooth.uartWriteLine('vc;b;' + modeToButton[newMode] + ';1;1;')
    } else {
        mode = null
    }
}


basic.clearScreen()

bluetooth.startUartService()

bluetooth.onBluetoothConnected(function () {
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let command = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    let commadParts = command.split("=")

    latestCommands[commadParts[0]] = parseFloat(commadParts[1])
})

basic.forever(function () {
    while (Object.keys(latestCommands).length) {
        let commandName = Object.keys(latestCommands)[0]
        let commandValue = latestCommands[commandName]
        delete latestCommands[commandName];

        if (commandName == "-v") {
            wuKong.setMotorSpeed(wuKong.MotorList.M1, 0)

            bluetooth.uartWriteLine('vc;import_start;')
            bluetooth.uartWriteLine('vc;init;')
            bluetooth.uartWriteLine('vc;sr;1;-100;100;1;0;0;0;;')
            bluetooth.uartWriteLine('vc;b;1;1;0;<i class="fa-solid fa-car-side"></i>;')
            bluetooth.uartWriteLine('vc;b;2;1;0;<i class="fa-solid fa-satellite-dish"></i>;')
            bluetooth.uartWriteLine('vc;b;5;0;0;<i class="fa-solid fa-clock-rotate-left"></i>;')
            bluetooth.uartWriteLine('vc;b;3;1;0;<i class="fa-solid fa-clock-rotate-left"></i>;')
            bluetooth.uartWriteLine('vc;b;4;0;0;4;')
            bluetooth.uartWriteLine('vc;il;-1;')
            bluetooth.uartWriteLine('vc;ir;1;')
            bluetooth.uartWriteLine('vc;show;sr,br,bl;')
            bluetooth.uartWriteLine('vc;import_end;')
        } else if (commandName == "oy" || commandName == "sl" || commandName == "jry") {
            wuKong.setMotorSpeed(wuKong.MotorList.M1, commandValue)
        } else if (commandName == "ox" || commandName == "sr" || commandName == "jrx") {
            wuKong.setMotorSpeed(wuKong.MotorList.M1, commandValue)
        } else if (commandName == "1" || commandName == "2" || commandName == "3") {
            if (commandName == "1") {
                switchMode(0)
            } else if (commandName == "2") {
                if (mode != 1) {
                    if (rotationDuration) {
                        sonarStartTime = input.runningTime()
                        wuKong.setMotorSpeed(wuKong.MotorList.M1, rotationSpeed)
                    }
                } else {
                    wuKong.setMotorSpeed(wuKong.MotorList.M1, 0)
                }
                switchMode(1)
            } else if (commandName == "3") {
                switchMode(2)

                if (mode == 2) {
                    rotationDurationMeasurement()
                }
            }
        }
    }
})

// Queue
let sendQueue: string[] = []
basic.forever(function () {
    while(sendQueue.length) {
        bluetooth.uartWriteLine(sendQueue.shift())
        basic.pause(20)
    }
})

let lastSignalTime = 0;

basic.forever(function () {
    if (mode == 0 && signalFrequency) {
        if (input.runningTime() - lastSignalTime - signalFrequency > 0) {
            music.play(music.tonePlayable(Note.C, music.beat(BeatFraction.Whole)), music.PlaybackMode.UntilDone)
            lastSignalTime = input.runningTime()
        }
    }
})

let lastAngle = 0;
let triggerAngle = 5;

basic.forever(function () {
    if (mode == 0) {
        let distance = sonar.ping(DigitalPin.P0, DigitalPin.P1, PingUnit.Centimeters)
        
        if (distance > 0 && distance < maxDistance) {
            signalFrequency = 25 * distance - 300
            sendQueue.push([input.runningTime(), distance].join(','))
        } else {
            signalFrequency = 0
        }

        basic.pause(200)
    } else if (mode == 1) {
        let distance = sonar.ping(DigitalPin.P0, DigitalPin.P1, PingUnit.Centimeters)
        let angle = ((input.runningTime() - sonarStartTime) % rotationDuration) * 360 / rotationDuration

        let angleCounter = angle - lastAngle;

        if (angleCounter < 0) {
            angleCounter = 360 + angle - lastAngle;
        }

        if (distance > 0 && distance < maxDistance || angleCounter >= triggerAngle) {
            sendQueue.push([input.runningTime(), distance, angle].join(','))

            lastAngle = angle;
        } else if (angleCounter >= triggerAngle) {
            sendQueue.push([input.runningTime(), 0, angle].join(','))
            lastAngle = angle;
        }

        basic.pause(20)
    }
})


function rotationDurationMeasurement() {
    let startTime: number = 0;
    let endTime: number = 0;

    wuKong.setMotorSpeed(wuKong.MotorList.M1, rotationSpeed)
    let nr = 0;
    let trigger = false;

    while ((!startTime || !endTime) && mode == 2) {
        let distance = sonar.ping(DigitalPin.P0, DigitalPin.P1, PingUnit.Centimeters)

        if (distance > 0 && distance < 10) {
            if (!trigger) {
                if (!startTime) {
                    startTime = input.runningTime()
                } else {
                    endTime = input.runningTime()
                }
            }

            trigger = true
        } else {
            trigger = false
        }

        basic.pause(50)
    }

    wuKong.setMotorSpeed(wuKong.MotorList.M1, 0)

    rotationDuration = endTime - startTime

    sendQueue.push('rotation;' + rotationDuration)
    switchMode(2)
}