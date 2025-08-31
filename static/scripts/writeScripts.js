function savePokemonData(data) {
    if (!data.identifier) {
        console.error('Identifier is required');
        return;
    }

    fetch('/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function toggleCaught(event) {
    const item = event.currentTarget;

    if (window.innerWidth <= 768 || navigator.maxTouchPoints > 0) {
        // Show confirmation for mobile users
        if (!confirm("Toggle caught status?")) {
            return; // Stop if user cancels
        }
    }

    // If the item is shiny locked, do nothing
    if(item.classList.contains('shiny-locked')){
        return;
    }
    // If the item is processing, remove the processing class
    var processing = item.classList.contains('processing');
    var processingTotal = getProgress("overall", "Processing");
    if (processing) {
        item.classList.remove('processing');
        processing = false;
        processingTotal -= 1;
    }

    item.classList.toggle('caught');
    const identifier = item.querySelector('.identifier').textContent.trim().toLowerCase();
    const caught = item.classList.contains('caught');
    let modifier = caught ? 1 : -1;
    
    let lastUpdated;
    let lastUpdatedProcessing = item.getAttribute("lastUpdatedProcessing")
    const oldDate = item.getAttribute('lastUpdatedCaught');
    if (oldDate) {
        tracker.modifySquare(new Date(oldDate), -1);
    }
    if (caught) {
        const currentDate = new Date().toLocaleDateString('sv-SE').split('T')[0];
        tracker.modifySquare(new Date(currentDate), 1);
        item.setAttribute('lastUpdatedCaught', currentDate);
        lastUpdated = currentDate;
    }
    else{
        lastUpdated = "";
        item.setAttribute('lastUpdatedCaught', "");
        item.setAttribute('lastUpdatedProcessing', "");
        if (oldDate) {
            tracker.modifySquare(new Date(oldDate), -1);
        }
        // Do not alter processing-only tracker here; maintained via processing date changes
    }
    savePokemonData({ identifier: identifier, caught: caught, processing: processing, lastUpdatedCaught: lastUpdated, lastUpdatedProcessing: lastUpdatedProcessing });
    showPokemonInfo(identifier, event);
    updateProgress("Caught", getProgress("overall", "Caught") + modifier, "#6ddd87", item.getAttribute('catchGeneration'), item.getAttribute('huntMethod'));
    updateProgress("Processing", processingTotal, "#ffa500", item.getAttribute('catchGeneration'), item.getAttribute('huntMethod'));
}

// Toggle 'processing' state (📋 icon)
function toggleProcessing(event) {
    event.stopPropagation(); // prevent the caught toggle
    const item = event.currentTarget.parentElement;
    // If already caught, do nothing
    if (item.classList.contains('caught')) {
        return;
    }
    const identifier = item.querySelector('.identifier').textContent.trim().toLowerCase();
    item.classList.toggle('processing');
    let modifier = item.classList.contains('processing') ? 1 : -1;


    let lastUpdated;
    const oldDate = item.getAttribute('lastUpdatedProcessing');
    if (oldDate) {
        tracker.modifySquare(new Date(oldDate), -1);
        processingTracker && processingTracker.modifySquare(new Date(oldDate), -1);
    }
    if (modifier > 0) {
        const currentDate = new Date().toLocaleDateString('sv-SE').split('T')[0];
        tracker.modifySquare(new Date(currentDate), 1);
        processingTracker && processingTracker.modifySquare(new Date(currentDate), 1);
        item.setAttribute('lastUpdatedProcessing', currentDate);
        lastUpdated = currentDate;
    }
    else{
        lastUpdated = "";
        item.setAttribute('lastUpdatedProcessing', "");
    }
    
    savePokemonData({ identifier: identifier, processing: item.classList.contains('processing'), lastUpdatedProcessing: lastUpdated });
    updateProgress("Processing", getProgress("overall", "Processing") + modifier, "#ffa500", item.getAttribute('catchGeneration'), item.getAttribute('huntMethod'));
}

function toggleShinyLock(event){
    event.stopPropagation(); // prevent the caught toggle
    const item = event.currentTarget.parentElement;
    const identifier = item.querySelector('.identifier').textContent.trim().toLowerCase();
    item.classList.toggle('shiny-locked');

    if (item.classList.contains('shiny-locked')) {
        processingModifier = item.classList.contains('processing') ? -1 : 0;
        caughtModifier = item.classList.contains('caught') ? -1 : 0;

        item.classList.remove('processing');
        item.classList.remove('caught');
        updateProgress("Processing", getProgress("overall", "Processing") + processingModifier, "#ffa500", item.getAttribute('catchGeneration'), item.getAttribute('huntMethod'));
        updateProgress("Caught", getProgress("overall", "Caught") + caughtModifier, "#6ddd87", item.getAttribute('catchGeneration'), item.getAttribute('huntMethod'));
        updateProgress("Shiny Locked", getProgress("overall", "Shiny Locked") + 1, "#ff5757", item.getAttribute('catchGeneration'), item.getAttribute('huntMethod'));
    }
    else{
        updateProgress("Shiny Locked", getProgress("overall", "Shiny Locked") - 1, "#ff5757", item.getAttribute('catchGeneration'), item.getAttribute('huntMethod'));
    }

    savePokemonData({
        identifier: identifier,
        shinyLocked: item.classList.contains('shiny-locked'),
        caught: false,
        processing: false
    });
}

function saveAttempts(event) {
    const attempts = document.getElementById('attempts-input').value;
    const duration = document.getElementById('duration-input').value;
    const gridItems = document.querySelectorAll('.grid-item');


    // Update the tooltip to show seconds per attempt
    const totalSeconds = textToSeconds(duration);
    const attemptsTooltip = document.getElementById('attempt-time-tooltip');
    if (attempts > 0) {
        const secondsPerAttempt = (totalSeconds / attempts).toFixed(2);
        
        attemptsTooltip.textContent = `${convertSecondsToTimeString(secondsPerAttempt)} / attempt`;
    } else {
        attemptsTooltip.textContent = 'No data on average attempt time';
        
    }

    // Update grid with in-progress class
    gridItems.forEach(item => {
        const itemIdentifier = item.querySelector('.identifier').textContent.trim().toLowerCase();
        if (itemIdentifier === currentPokemon) {
            if (attempts > 0) {
                item.classList.add('in-progress');
            }
            else {
                item.classList.remove('in-progress');
            }
        }
    });

    if (currentPokemon) {
        savePokemonData({ identifier: currentPokemon, attempts: attempts, time: duration });
    }
}

function convertSecondsToTimeString(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const timeSegments = [];
    if (h > 0) timeSegments.push(`${h}h`);
    if (m > 0) timeSegments.push(`${m}m`);
    if (s > 0 || timeSegments.length === 0) timeSegments.push(`${s}s`);
    return timeSegments.join(' ');
}

function clearAttempts(event) {
    document.getElementById('attempts-input').value = 0;
    document.getElementById('duration-input').value = "00:00:00";

    // Update the tooltip to show seconds per attempt as no data
    const attemptsTooltip = document.getElementById('attempt-time-tooltip');
    attemptsTooltip.textContent = 'No data on average attempt time';

    const gridItems = document.querySelectorAll('.grid-item');
    gridItems.forEach(item => {
        const itemIdentifier = item.querySelector('.identifier').textContent.trim().toLowerCase();
        if (itemIdentifier === currentPokemon) {
            item.classList.remove('in-progress');
        }
    });

    if (currentPokemon) {
        savePokemonData({ identifier: currentPokemon, attempts: 0, time: 0});
    }
}

function updateDate(field, value) {
    // Build a data object with the current Pokémon identifier.
    const dataToSave = {
        identifier: currentPokemon,
    };
    // Add the updated date field
    dataToSave[field] = value;
    if (currentPokemon) {
        savePokemonData(dataToSave);
    }
    if(field == "lastUpdatedCaught"){
        if(currentCaughtDate.length > 0){ tracker.modifySquare(new Date(currentCaughtDate), -1);}
        currentCaughtDate = value
        
    }
    else if(field == "lastUpdatedProcessing"){
        if(currentProcessingDate.length > 0){ tracker.modifySquare(new Date(currentProcessingDate), -1); processingTracker && processingTracker.modifySquare(new Date(currentProcessingDate), -1); }
        currentProcessingDate = value
    }
    tracker.modifySquare(new Date(value), 1);
    if(field == "lastUpdatedProcessing"){
        processingTracker && processingTracker.modifySquare(new Date(value), 1);
    }
}

// Notes view/edit/save
function editNotes() {
    const view = document.getElementById('notes-view');
    const addContainer = document.getElementById('notes-add');
    const edit = document.getElementById('notes-edit');
    const textarea = document.getElementById('notes-textarea');
    textarea.value = view.textContent || '';
    view.style.display = 'none';
    addContainer.style.display = 'none';
    edit.style.display = 'block';
}

function cancelNotesEdit() {
    const view = document.getElementById('notes-view');
    const addContainer = document.getElementById('notes-add');
    const edit = document.getElementById('notes-edit');
    edit.style.display = 'none';
    if ((view.textContent || '').trim().length === 0) {
        view.style.display = 'none';
        addContainer.style.display = 'flex';
    } else {
        view.style.display = 'block';
        addContainer.style.display = 'none';
    }
}

function saveNotes() {
    if (!currentPokemon) return;
    const textarea = document.getElementById('notes-textarea');
    const notes = textarea.value;
    savePokemonData({ identifier: currentPokemon, notes: notes });
    const view = document.getElementById('notes-view');
    const addContainer = document.getElementById('notes-add');
    view.textContent = notes || '';
    if ((view.textContent || '').trim().length === 0) {
        view.style.display = 'none';
        addContainer.style.display = 'flex';
    } else {
        view.style.display = 'block';
        addContainer.style.display = 'none';
    }
    cancelNotesEdit();
}

function addNotes() {
    editNotes();
}

// Functions for adding a new set of attempt and duration to the running count 

function textToSeconds(text) {
    const [hours, minutes, seconds] = text.split(':').map(Number);
    return (hours * 3600) + (minutes * 60) + seconds;
}

function secondsToText(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function openTimeModal(event){
    const modal = document.getElementById("attempt-modal");
    modal.style.display = "flex";
}

function addAndSave(event){
    const modal = document.getElementById("attempt-modal");
    const addAttempts = document.getElementById("add-attempts").value;
    const addDuration = document.getElementById("add-duration").value;
    const attempts = document.getElementById("attempts-input").value;
    const duration = document.getElementById("duration-input").value;
    const totalAttempts = parseInt(attempts) + parseInt(addAttempts);
    const totalDuration = textToSeconds(duration) + textToSeconds(addDuration);
    document.getElementById("attempts-input").value = totalAttempts;
    document.getElementById("duration-input").value = secondsToText(totalDuration);
    
    saveAttempts(event);
    modal.style.display = "none";
    document.getElementById("add-attempts").value = 0;
    document.getElementById("add-duration").value = "00:00:00";
}

function closeTimeModal(event){
    const modal = document.getElementById("attempt-modal");
    modal.style.display = "none";
}