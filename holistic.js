import DeviceDetector from "https://cdn.jsdelivr.net/npm/device-detector-js@2.2.10/+esm";
// Usage: testSupport({client?: string, os?: string}[])
// Client and os are regular expressions.
// See: https://cdn.jsdelivr.net/npm/device-detector-js@2.2.10/README.md for
// legal values for client and os
testSupport([
    { client: 'Chrome' },
]);
function testSupport(supportedDevices) {
    const deviceDetector = new DeviceDetector();
    const detectedDevice = deviceDetector.parse(navigator.userAgent);
    let isSupported = false;
    for (const device of supportedDevices) {
        if (device.client !== undefined) {
            const re = new RegExp(`^${device.client}$`);
            if (!re.test(detectedDevice.client.name)) {
                continue;
            }
        }
        if (device.os !== undefined) {
            const re = new RegExp(`^${device.os}$`);
            if (!re.test(detectedDevice.os.name)) {
                continue;
            }
        }
        isSupported = true;
        break;
    }
    if (!isSupported) {
        alert(`This demo, running on ${detectedDevice.client.name}/${detectedDevice.os.name}, ` +
            `is not well supported at this time, continue at your own risk.`);
    }
}
const controls = window;
const mpHolistic = window;
const drawingUtils = window;
const config = { locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@` +
            `${mpHolistic.VERSION}/${file}`;
    } };
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const controlsElement = document.getElementsByClassName('control-panel-host')[0];
const canvasCtx = canvasElement.getContext('2d');
const fpsControl = new controls.FPS();
const spinner = document.querySelector('.loading');
spinner.ontransitionend = () => {
    spinner.style.display = 'none';
};
function removeElements(landmarks, elements) {
    for (const element of elements) {
        delete landmarks[element];
    }
}
function removeLandmarks(results) {
    if (results.poseLandmarks) {
        removeElements(results.poseLandmarks, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20, 21, 22]);
    }
}
function connect(ctx, connectors) {
    const canvas = ctx.canvas;
    for (const connector of connectors) {
        const from = connector[0];
        const to = connector[1];
        if (from && to) {
            if (from.visibility && to.visibility &&
                (from.visibility < 0.1 || to.visibility < 0.1)) {
                continue;
            }
            ctx.beginPath();
            ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
            ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
            ctx.stroke();
        }
    }
}
let activeEffect = 'mask';
let mouthIsOpen = false;
const handClosedState = { left: null, right: null };

function distanceBetween(firstPoint, secondPoint) {
    return Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y);
}

function jointAngle(firstPoint, vertex, secondPoint) {
    const firstVector = {
        x: firstPoint.x - vertex.x,
        y: firstPoint.y - vertex.y
    };
    const secondVector = {
        x: secondPoint.x - vertex.x,
        y: secondPoint.y - vertex.y
    };
    const dotProduct = firstVector.x * secondVector.x + firstVector.y * secondVector.y;
    const firstLength = Math.hypot(firstVector.x, firstVector.y);
    const secondLength = Math.hypot(secondVector.x, secondVector.y);
    return Math.acos(Math.max(-1, Math.min(1, dotProduct / (firstLength * secondLength)))) *
        180 / Math.PI;
}

function detectMouthOpening(faceLandmarks) {
    if (!faceLandmarks) {
        return;
    }
    const mouthHeight = distanceBetween(faceLandmarks[13], faceLandmarks[14]);
    const mouthWidth = distanceBetween(faceLandmarks[61], faceLandmarks[291]);
    const openness = mouthHeight / mouthWidth;
    const isOpen = mouthIsOpen ? openness > 0.12 : openness > 0.18;
    if (isOpen === mouthIsOpen) {
        return;
    }
    mouthIsOpen = isOpen;
    document.dispatchEvent(new CustomEvent(isOpen ? 'mouthopen' : 'mouthclose', {
        detail: { openness }
    }));
}

function detectClosedHand(handLandmarks, handSide) {
    if (!handLandmarks) {
        handClosedState[handSide] = null;
        return;
    }
    const fingerJoints = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
    const extendedFingers = fingerJoints.filter(([baseIndex, jointIndex, middleIndex, tipIndex]) => {
        const fingerAngle = jointAngle(handLandmarks[baseIndex], handLandmarks[jointIndex], handLandmarks[middleIndex]);
        return fingerAngle > 115 && distanceBetween(handLandmarks[tipIndex], handLandmarks[0]) >
            distanceBetween(handLandmarks[jointIndex], handLandmarks[0]);
    }).length;
    const thumbIsExtended = jointAngle(handLandmarks[2], handLandmarks[3], handLandmarks[4]) > 125 &&
        distanceBetween(handLandmarks[4], handLandmarks[5]) >
        distanceBetween(handLandmarks[3], handLandmarks[5]) * 1.2;
    const totalExtendedFingers = extendedFingers + (thumbIsExtended ? 1 : 0);
    const isClosed = totalExtendedFingers === 0;
    if (totalExtendedFingers === handClosedState[handSide]) {
        return;
    }
    handClosedState[handSide] = totalExtendedFingers;
    document.dispatchEvent(new CustomEvent(isClosed ? 'handclosed' : 'handopen', {
        detail: { hand: handSide, extendedFingers: totalExtendedFingers }
    }));
}

const eventMessage = document.getElementById('event-message');

function logEvent(message) {
    eventMessage.textContent = message;
}

document.addEventListener('mouthopen', () => {
    logEvent('Bocca aperta');
});

document.addEventListener('mouthclose', () => {
    logEvent('Bocca chiusa');
});

document.addEventListener('handclosed', (event) => {
    logEvent(`Mano chiusa - ${event.detail.extendedFingers} dita`);
});

document.addEventListener('handopen', (event) => {
    logEvent(`Mano aperta - ${event.detail.extendedFingers} dita`);
});

function onResults(results) {
    document.body.classList.add('loaded');
    removeLandmarks(results);
    detectMouthOpening(results.faceLandmarks);
    detectClosedHand(results.leftHandLandmarks, 'left');
    detectClosedHand(results.rightHandLandmarks, 'right');
    fpsControl.tick();
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (results.segmentationMask) {
        canvasCtx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
        if (activeEffect === 'mask' || activeEffect === 'both') {
            canvasCtx.globalCompositeOperation = 'source-in';
            canvasCtx.fillStyle = '#00FF007F';
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        }
        else {
            canvasCtx.globalCompositeOperation = 'source-out';
            canvasCtx.fillStyle = '#0000FF7F';
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        }
        canvasCtx.globalCompositeOperation = 'destination-atop';
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.globalCompositeOperation = 'source-over';
    }
    else {
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    }
    canvasCtx.lineWidth = 5;
    if (results.poseLandmarks) {
        if (results.rightHandLandmarks) {
            canvasCtx.strokeStyle = 'white';
            connect(canvasCtx, [[
                    results.poseLandmarks[mpHolistic.POSE_LANDMARKS.RIGHT_ELBOW],
                    results.rightHandLandmarks[0]
                ]]);
        }
        if (results.leftHandLandmarks) {
            canvasCtx.strokeStyle = 'white';
            connect(canvasCtx, [[
                    results.poseLandmarks[mpHolistic.POSE_LANDMARKS.LEFT_ELBOW],
                    results.leftHandLandmarks[0]
                ]]);
        }
    }
    if (results.poseLandmarks) {
        drawingUtils.drawConnectors(canvasCtx, results.poseLandmarks, mpHolistic.POSE_CONNECTIONS, { color: 'white' });
        drawingUtils.drawLandmarks(canvasCtx, Object.values(mpHolistic.POSE_LANDMARKS_LEFT)
            .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'white', fillColor: 'rgb(255,138,0)' });
        drawingUtils.drawLandmarks(canvasCtx, Object.values(mpHolistic.POSE_LANDMARKS_RIGHT)
            .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'white', fillColor: 'rgb(0,217,231)' });
    }
    drawingUtils.drawConnectors(canvasCtx, results.rightHandLandmarks, mpHolistic.HAND_CONNECTIONS, { color: 'white' });
    drawingUtils.drawLandmarks(canvasCtx, results.rightHandLandmarks, {
        color: 'white',
        fillColor: 'rgb(0,217,231)',
        lineWidth: 2,
        radius: (data) => {
            return drawingUtils.lerp(data.from.z, -0.15, .1, 10, 1);
        }
    });
    drawingUtils.drawConnectors(canvasCtx, results.leftHandLandmarks, mpHolistic.HAND_CONNECTIONS, { color: 'white' });
    drawingUtils.drawLandmarks(canvasCtx, results.leftHandLandmarks, {
        color: 'white',
        fillColor: 'rgb(255,138,0)',
        lineWidth: 2,
        radius: (data) => {
            return drawingUtils.lerp(data.from.z, -0.15, .1, 10, 1);
        }
    });
    drawingUtils.drawConnectors(canvasCtx, results.faceLandmarks, mpHolistic.FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
    drawingUtils.drawConnectors(canvasCtx, results.faceLandmarks, mpHolistic.FACEMESH_RIGHT_EYE, { color: 'rgb(0,217,231)' });
    drawingUtils.drawConnectors(canvasCtx, results.faceLandmarks, mpHolistic.FACEMESH_RIGHT_EYEBROW, { color: 'rgb(0,217,231)' });
    drawingUtils.drawConnectors(canvasCtx, results.faceLandmarks, mpHolistic.FACEMESH_LEFT_EYE, { color: 'rgb(255,138,0)' });
    drawingUtils.drawConnectors(canvasCtx, results.faceLandmarks, mpHolistic.FACEMESH_LEFT_EYEBROW, { color: 'rgb(255,138,0)' });
    drawingUtils.drawConnectors(canvasCtx, results.faceLandmarks, mpHolistic.FACEMESH_FACE_OVAL, { color: '#E0E0E0', lineWidth: 5 });
    drawingUtils.drawConnectors(canvasCtx, results.faceLandmarks, mpHolistic.FACEMESH_LIPS, { color: '#E0E0E0', lineWidth: 5 });
    canvasCtx.restore();
}
const holistic = new mpHolistic.Holistic(config);
holistic.onResults(onResults);
new controls
    .ControlPanel(controlsElement, {
    selfieMode: true,
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    effect: 'background',
})
    .add([
    new controls.StaticText({ title: 'MediaPipe Holistic' }),
    fpsControl,
    new controls.Toggle({ title: 'Selfie Mode', field: 'selfieMode' }),
    new controls.SourcePicker({
        onSourceChanged: () => {
            holistic.reset();
        },
        onFrame: async (input, size) => {
            const aspect = size.height / size.width;
            let width, height;
            if (window.innerWidth > window.innerHeight) {
                height = window.innerHeight;
                width = height / aspect;
            }
            else {
                width = window.innerWidth;
                height = width * aspect;
            }
            canvasElement.width = width;
            canvasElement.height = height;
            await holistic.send({ image: input });
        },
    }),
    new controls.Slider({
        title: 'Model Complexity',
        field: 'modelComplexity',
        discrete: ['Lite', 'Full', 'Heavy'],
    }),
    new controls.Toggle({ title: 'Smooth Landmarks', field: 'smoothLandmarks' }),
    new controls.Toggle({ title: 'Enable Segmentation', field: 'enableSegmentation' }),
    new controls.Toggle({ title: 'Smooth Segmentation', field: 'smoothSegmentation' }),
    new controls.Slider({
        title: 'Min Detection Confidence',
        field: 'minDetectionConfidence',
        range: [0, 1],
        step: 0.01
    }),
    new controls.Slider({
        title: 'Min Tracking Confidence',
        field: 'minTrackingConfidence',
        range: [0, 1],
        step: 0.01
    }),
    new controls.Slider({
        title: 'Effect',
        field: 'effect',
        discrete: { 'background': 'Background', 'mask': 'Foreground' },
    }),
])
    .on(x => {
    const options = x;
    videoElement.classList.toggle('selfie', options.selfieMode);
    activeEffect = x['effect'];
    holistic.setOptions(options);
});

const panelShell = controlsElement.querySelector('.control-panel-shell');
const commandPanel = panelShell?.querySelector('.control-panel');
if (panelShell && commandPanel) {
    panelShell.remove();
    controlsElement.appendChild(commandPanel);
    commandPanel.classList.add('commands-panel');

    const hamburger = document.createElement('button');
    hamburger.type = 'button';
    hamburger.className = 'commands-toggle';
    hamburger.textContent = '☰';
    hamburger.setAttribute('aria-label', 'Mostra o nascondi il pannello dei comandi');
    hamburger.title = 'Mostra o nascondi il pannello dei comandi';
    commandPanel.classList.add('commands-panel-hidden');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.addEventListener('click', () => {
        const isHidden = commandPanel.classList.toggle('commands-panel-hidden');
        hamburger.setAttribute('aria-expanded', String(!isHidden));
    });
    controlsElement.appendChild(hamburger);
}
