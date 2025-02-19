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
    }
    if (modifier > 0) {
        const currentDate = new Date().toLocaleDateString('sv-SE').split('T')[0];
        tracker.modifySquare(new Date(currentDate), 1);
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
    if (currentPokemon) {
        savePokemonData({ identifier: currentPokemon, attempts: attempts });
    }
}

function clearAttempts(event) {
    document.getElementById('attempts-input').value = 0;
    if (currentPokemon) {
        savePokemonData({ identifier: currentPokemon, attempts: 0 });
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
        if(currentProcessingDate.length > 0){ tracker.modifySquare(new Date(currentProcessingDate), -1); }
        currentProcessingDate = value
    }
    tracker.modifySquare(new Date(value), 1);
}