const SERVER = 'https://vc.pas-md.com/apk/pasmd';
const postData = async (path = '', payload = {}) => {
    try {
        const data = await fetch(
            `${SERVER}/${path}`,
            {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authtoken': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJUF9TRVNTSU9OX0lEIjoxMDgzMDEsIk9SR19JRCI6MiwiTE9DX0lEIjoxLCJpYXQiOjE1OTcyNDAzOTR9.QT9RZ4BCqY2eFYuFd7liJIG-C4x1n2fvRcUxW5fq8tU'
            },
            body: JSON.stringify(payload)
            }
        );
        return data.json();
    } catch (err) {
        console.error(`Error getting doctors: ${err}`);
        throw new Error(err);
    }
};

function getFormattedDate(time = new Date(), isForUI = false) {
    let dateElements = time.toString().split(" ");

    const DAY = dateElements[0];
    const MONTH = dateElements[1];
    const DATE = dateElements[2];
    const YEAR = dateElements[3].substring(2);
    const LABEL = (isForUI) ? `${DAY}, ${MONTH} ${DATE}` : `${DATE}-${MONTH}-${YEAR}`;

    let timeAtMidnight = new Date(`${MONTH} ${DATE}, ${dateElements[3]}`);
    timeAtMidnight.setHours(0,0,0,0);

    return { label : LABEL, value : timeAtMidnight }
}

function getFormattedTime(time = "") {
    const DATETIME = new Date(time);
    let hour = DATETIME.getHours();
    let mins = DATETIME.getMinutes();
    let ampm = "am";

    if (hour > 12) {
        hour -= 12;
        ampm = "pm";
    }

    if (mins < 10) {
        mins = "0" + mins;
    }

    return `${hour}:${mins} ${ampm}`;
}

function formatCurrency(amount = "0", currency = 'JMD') {
    if (amount === null || amount === undefined)
        return '';

    amount = `${amount}`;
    const HAS_DECIMAL = amount.includes(".");
    let dollars, cents;
    if (HAS_DECIMAL) {
        const DECIMAL_POSITION = amount.indexOf('.');
        dollars = amount.substring(0, DECIMAL_POSITION );
        cents = amount.substring(DECIMAL_POSITION + 1);
        cents += cents.length < 2 ? '0' : '';
        cents = cents.length > 2 ? cents.substring(0, 2) : cents;
    }
    else {
        dollars = amount;
        cents = '00';
    }

    let result = '';
    let commaTracker = 0
    for( i = dollars.length-1; i>=0; i--) {
        commaTracker++;
        if (commaTracker === 4) {
            result = `${dollars[i]},` + result;
            commaTracker = 1;
        }
        else
            result = `${dollars[i]}` + result;
    }

    return `$ ${result}.${cents} ${currency}`;
}

$(function() {
    let doctors = [];
    let schedule = {};
    let noOfDays = 6;
    let scheduleDays = [];
    let showModal = false;

    function toggleLoadingModal() {
        showModal = !showModal;
        if (showModal) {
            $('#modal').show();
        }
        else {
            $('#modal').hide();
        }
    }

    function triggerSuccessModal(message = '') {
        $('#f-modal-success').show();
        $('#f-modal-message').html(message);
        $('#custom-modals').show();
    }

    function triggerErrorModal(message = '') {
        $('#f-modal-error').show();
        $('#f-modal-message').html(message);
        $('#custom-modals').show();
    }

    function triggerWarningModal(message = '') {
        $('#f-modal-warning').show();
        $('#f-modal-message').html(message);
        $('#custom-modals').show();
    }

    function closeAlertModal() {
        $('#f-modal-success').hide();
        $('#f-modal-warning').hide();
        $('#f-modal-error').hide();
        $('#custom-modals').hide();
    }

    function getTodayDate(now = new Date()) {
        var day = ("0" + now.getDate()).slice(-2);
        var month = ("0" + (now.getMonth() + 1)).slice(-2);
        return now.getFullYear()+"-"+(month)+"-"+(day);
    }

    function setupDateField() {
        var today = getTodayDate();

        $('#date-selector').val(today);
        $('#date-selector').change(updateDoctorsCallback);
    }

    function updateHiddenFields(doctorId, appointmentId, appointmentDate, appointmentTime) {
        let target = doctors.filter(doctor => doctor.DOC_ID == doctorId);
        if (target.length > 0) {
            $('#apmt-doctor-id').val(target[0].DOC_ID);
            $('#apmt-doctor-name').val(target[0].DOCTOR_NAME);
            $('#apmt-doctor-cred').val(target[0].DEGREES_FMT);
            $('#apmt-doctor-spec').val(target[0].SPECILIZATION);
            $('#apmt-cost').val(target[0].CONS_FEE);
            $('#apmt-id').val(appointmentId);

            let amptDay = new Date(appointmentDate);
            $('#apmt-value-date').val(getFormattedDate(amptDay, true).label);
            $('#apmt-value-time').val(getFormattedTime( appointmentTime) );
        }
    }

    function setupDateSelectorButtons() {
        let slots = document.getElementsByClassName('slot');
        for(i=0; i< slots.length; i++) {
            slots[i].addEventListener('click', () => {
                const APPOINTMENT_ID = $(this).val();
                const DOCTOR_ID = event.srcElement.getAttribute('ref');
                const APPOINTMENT_DATE = event.srcElement.getAttribute('date');
                const APPOINTMENT_TIME = event.srcElement.getAttribute('time');

                console.warn(`You clicked button ${DOCTOR_ID}|${APPOINTMENT_ID}|${APPOINTMENT_DATE}|${APPOINTMENT_TIME}`);
                updateHiddenFields(DOCTOR_ID, APPOINTMENT_ID, APPOINTMENT_DATE, APPOINTMENT_TIME);
            });
        }
    }

    function setupDateSelectorDropdowns(dateFieldID = "", selectFieldID = "", doctorID = "") {
        $(`#${dateFieldID}`).change(() => {
            toggleLoadingModal();
            const fieldId = `#${dateFieldID}`;
            let selectDate = new Date(`${$(fieldId).val()}T00:00:00`);
            $(`#${selectFieldID}`).empty();

            let option = $(`<option value="" hidden disabled selected> - Select a Time - </option>`);
            $(`#${selectFieldID}`).append(option);

            postData("getSlots", {'docId': `${doctorID}`, 'aptDate': `${getFormattedDate(selectDate, false)['label']}` })
                .then(dataset => {
                    dataset.forEach((data) => {
                        let timeOption = $(`<option value="${doctorID}|${data.SLOTS_ID}|${data.APMNT_DT}|${data.DISPLAY_TIME}" >${getFormattedTime( data.DISPLAY_TIME )}</option>`);
                        $(`#${selectFieldID}`).append(timeOption);
                    });
                    if (dataset.length === 0) {
                        let timeOption = $(`<option value="" disabled>No time available</option>`);
                        $(`#${selectFieldID}`).append(timeOption);
                    }
                    toggleLoadingModal();
                })
                .catch(error => {
                    toggleLoadingModal();
                    triggerErrorModal('Something went wrong when trying to update your request');
                    console.error(`[MOBILE-SELECTOR] Unable to complete API Request...\n${error}`);
                });
        });
    }

    function applySelectorDropdownEvents() {
        let mobileDropdowns = document.getElementsByClassName('mobile-apmt-picker');
        for(let dropdown of mobileDropdowns) {
            dropdown.addEventListener('change', () => {
                const DOCTOR_ID = $(this).val().split('|')[0];
                const APPOINTMENT_ID = $(this).val().split('|')[1];
                const APPOINTMENT_DATE = $(this).val().split('|')[2];
                const APPOINTMENT_TIME = $(this).val().split('|')[3];
                updateHiddenFields(DOCTOR_ID, APPOINTMENT_ID, APPOINTMENT_DATE, APPOINTMENT_TIME);
            })
        }
    }

    function applyAppointmentSubmit() {
        $('#apmt-submit').click(() => {
            const payload = {
                patName: `${$('#apmt-firstname').val()} ${$('#apmt-lastname').val()}`,
                emailId: $('#apmt-email').val(),
                mobileNo: $('#apmt-phone').val(),
                genderCd: $('#apmt-gender-selector').val(),
                stateName: $('#apmt-parish-selector').val(),
                cityName: $('#apmt-city').val(),
                patId: $('#apmt-id').val()
            }

            toggleLoadingModal();
            console.info(payload);
            postData('bookAppointment', payload).then(data => {
                toggleLoadingModal();
            }).catch(error => {
                toggleLoadingModal();
                triggerErrorModal('Something went wrong when during setup. Please try again later.');
            });
        });
    }

    function generateHiddenSection() {
        return `<div id="hidden" class="section">
            <div class="section-col">
                <div>
                    <label for="apmt-doctor-name">Doctor</label>
                    <input id="apmt-doctor-name" class="apmt-field" disabled/>
                </div>
                <div>
                    <label for="apmt-doctor-cred">Credentials</label>
                    <input id="apmt-doctor-cred" class="apmt-field" disabled/>
                </div>
                <div>
                    <label for="apmt-doctor-spec">Specialty</label>
                    <input id="apmt-doctor-spec" class="apmt-field" disabled/>
                </div>
            </div>
            <div class="section-col">
                <div>
                    <label for="apmt-id">Apmt. ID</label>
                    <input id="apmt-id" class="apmt-field" disabled/>
                </div>
                <div>
                    <label for="apmt-doctor-id">Doctor ID</label>
                    <input id="apmt-doctor-id" class="apmt-field" disabled/>
                </div>
                <div>
                    <label for="apmt-cost">Cost</label>
                    <input id="apmt-cost" class="apmt-field" disabled/>
                </div>
            </div>
            <div class="section-col">
                <div>
                    <label for="apmt-value-date">Date</label>
                    <input id="apmt-value-date" class="apmt-field" disabled/>
                </div>
                <div>
                    <label for="apmt-value-time">Time</label>
                    <input id="apmt-value-time" class="apmt-field" disabled/>
                </div>
            </div>
        </div>`;
    }

    function  generateScheduleDays() {
        scheduleDays = [];

        for(i = 0; i < noOfDays; i++ ) {
            let day = new Date(`${$('#date-selector').val()}T00:00:00`);
            day.setHours(0,0,0,0);
            day.setDate(day.getDate() + i);
            scheduleDays.push(getFormattedDate(day, true))
        }

        scheduleDays = [...new Set(scheduleDays)];
    }

    function generateModal() {
        return `<div id="modal">
            <div id="modal-loading" class="modal-body">
                <div class="modal-title">LOADING</div>
                <div class="modal-content">
                    <div class="lds-ring">
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function generateAlertModal() {
        return `<div class="f-modal-alert">
            <div id="f-modal-error" class="f-modal-icon f-modal-error animate" style="display:none">
                <span class="f-modal-x-mark">
                    <span class="f-modal-line f-modal-left animateXLeft"></span>
                    <span class="f-modal-line f-modal-right animateXRight"></span>
                </span>
                <div class="f-modal-placeholder"></div>
                <div class="f-modal-fix"></div>
            </div>
            <div id="f-modal-warning" class="f-modal-icon f-modal-warning scaleWarning" style="display:none">
                <span class="f-modal-body pulseWarningIns"></span>
                <span class="f-modal-dot pulseWarningIns"></span>
            </div>
            <div id="f-modal-success" class="f-modal-icon f-modal-success animate" style="display:none">
                <span class="f-modal-line f-modal-tip animateSuccessTip"></span>
                <span class="f-modal-line f-modal-long animateSuccessLong"></span>
                <div class="f-modal-placeholder"></div>
                <div class="f-modal-fix"></div>
            </div>
            <div id="f-modal-message"></div>
            <div>
                <button id="f-modal-close" class="f-modal-button">Close</div>
            </div>
        </div>`;
    }

    function generateDateSelectorField() {
        return `<div>
            <label for="date-selector">Start Date</label>
            <input id="date-selector" type="date" class="apmt-field" />
        </div>`;
    }

    function generateCard(doctorName = 'Dr. John Doe', doctorCreds = 'BSc., MBBS', doctorSpecialty = 'General Medicine', doctorCost = 0, doctorIndex = 0, scheduleDays = [], scheduleTimes = [], showTabs = false){
        let leftSide = generateProfile(doctorName, doctorCreds, doctorSpecialty, doctorCost, doctorIndex);
        let rightSide = generateDoctorSchedule(scheduleDays, scheduleTimes, showTabs);

        return `<div class="card">
            ${leftSide}
            ${rightSide}
        </div>`;
    }

    function generateMobileDoctorSchedule(index = 0) {
        return `<div class="selection-section-sml">
            <div class="col">
                <label for="apmt-date-selector-${index}">Appointment Date</label>
                <input id="apmt-date-selector-${index}" type="date" class="apmt-field"/>
            </div>
            <div class="col">
                <label for="apmt-time-selector-${index}">Appointment Time</label>
                <select id="apmt-time-selector-${index}" class="apmt-field mobile-apmt-picker">
                    <option value ="" hidden disabled selected> - Select a Time - </option>
                </select>
            </div>
            <div>
                <button id="apmt-select-submit-${index}" class="bttn bttn-sml">Next</button>
            </div>
        </div>`;
    }

    function generateProfile(doctorName = 'Dr. John Doe', doctorCreds = 'BSc., MBBS', doctorSpecialty = 'General Medicine', doctorCost = 0, doctorIndex = 0){
        return `<div class="card-left">
            <div class="details-section">
                <div id="doctor-${doctorIndex}-name" class="doctor-name">${doctorName}</div>
                <div id="doctor-${doctorIndex}-cred" class="doctor-info">${doctorCreds}</div>
                <div id="doctor-${doctorIndex}-spec" class="doctor-details">${doctorSpecialty}</div>
                <div id="doctor-${doctorIndex}-cost" class="doctor-details">${formatCurrency(doctorCost)}</div>
                </br>
                <div class="select-indicator">Select an available time →</div>
            </div>
            ${generateMobileDoctorSchedule(doctorIndex)}
        </div>`;
    }

    function generateDoctorSchedule(scheduleDays = [], scheduleTimes = [], showTabs = false) {
        let tabsSection = `<div class="date-tabs">
            ${scheduleDays.map(day => { return`<div class="date-tab">${day["label"]}</div>` }).join('')}
        </div>`;
    
        let scheduleSection = `<div class="schedule-overflow">
            ${scheduleDays.map(day => {
                let dailySlots = scheduleTimes.filter( time => time.APMNT_DT.substring(0,10) === day["value"].toISOString().substring(0,10) );
    
                if (dailySlots.length === 0)
                    return `<div class="col"> <button class="slot">None</button> </div>`;
    
                return `<div class="col">
                    ${dailySlots.map(slot => {
                        return `<button class="slot" ref="${slot.DOC_ID}" value="${slot.SLOTS_ID}" date="${slot.APMNT_DT}" time="${slot.DISPLAY_TIME}">${getFormattedTime(slot.DISPLAY_TIME)}</button>`;
                    }).join('')}
                </div>`;
            }).join('')}
        </div>`;
    
        return `<div class="card-right"> ${showTabs? tabsSection : ''} ${scheduleSection} </div>`;
    }

    function updatePageCallback() {
        let content = "";
        let index = 0;
        let firstElement = true;
        for (const docId in schedule) {
            if (schedule.hasOwnProperty(docId)) {
                let physician = doctors.find(function(doctor) {
                    return doctor["DOC_ID"] == docId;
                });
                

                content += generateCard(physician["DOCTOR_NAME"], physician["DEGREES_FMT"], physician["SPECILIZATION"], physician["CONS_FEE"], index, scheduleDays, schedule[docId], firstElement);
                firstElement = false;
                index++;
            }
        }
    
        $('#main').html(content);
        index = 0;
        for(const docId in schedule) {
            setupDateSelectorDropdowns(`apmt-date-selector-${index}`, `apmt-time-selector-${index}`, docId);
            index++;
        }
        setupDateSelectorButtons();
        applySelectorDropdownEvents();
        toggleLoadingModal();
    }

    function handleComplexSchedule() {
        for(const docId in schedule) {
            let temp = [];
            schedule[docId].forEach( list => temp = temp.concat(list) );
            schedule[docId] = temp;
        }
        updatePageCallback();
    }
 
    function updateAllDoctorsAgenda() {
        let counter = 0;
        doctors.forEach(doctor => {
            let doctorSchedule = scheduleDays.map(day => {
                return postData("getSlots", {'docId': `${doctor.DOC_ID}`, 'aptDate': `${getFormattedDate(day.value, false)['label']}` })
            });
            Promise.all(doctorSchedule).then(agenda => {
                schedule[`${doctor.DOC_ID}`] = agenda;
                counter++;
                if (counter === doctors.length) {
                    handleComplexSchedule();
                }
            }).catch(error => {
                triggerErrorModal('Something went wrong when updating the schedule. Please try again later.');
                console.error(`An error with the requests: ${error}`);
            });
        });
    }

    function includeDummyDoctor() {
        doctors.push({
            "DOC_ID": 223,
            "DOCTOR_NAME": "John A Doe",
            "DEGREES_FMT": "MDCM, FACS, FAANS (Physcian)",
            "SPECILIZATION": "General Practicioner",
            "EXPERIENCE": null,
            "PRACTICE_NAME": "Pure Jamaica Medical Centre",
            "SPECIALIZATION_ID": "00,00",
            "SPECIALITY_ID": 0,
            "LOCATION_ADDR": "1 Stanton Terrace,  The Stantons , Kingston 6 , New Kingston",
            "REG_FEE": 50,
            "CONS_FEE": 5000
        });
    }
    
    function updateDoctorsCallback() {
        toggleLoadingModal();
        let startDate = new Date(`${$('#date-selector').val()}T00:00:00`);

        generateScheduleDays();
        if (doctors === null || doctors === undefined || doctors.length == 0)
            postData('getAllDoctors').then( data => {
                doctors = data;
                includeDummyDoctor();
                scheduleCounter = doctors.length * noOfDays;
                progressCounter = 0;
                updateAllDoctorsAgenda();
            }).catch(error => {
                triggerErrorModal('Something went wrong during setup. Please try again later.');
                console.error(`Something went wrong with your request. ${error}`);
            });
        else {
            schedule = {};
            progressCounter = 0;u
            updateAllDoctorsAgenda();
        }
    }
    
    
    $('#control-panel').html(generateModal() + generateHiddenSection() + generateDateSelectorField() );
    $('#custom-modals').html( generateAlertModal() );
    $('#f-modal-close').click(() => closeAlertModal() );
    setupDateField();
    updateDoctorsCallback();
});
