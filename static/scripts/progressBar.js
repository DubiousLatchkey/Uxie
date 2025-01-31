let progressData = {};
        
function setProgress(progressName, updates, totalValue) {
    if (!progressData[progressName]) {
        progressData[progressName] = [];
    }
    let dataMap = new Map(progressData[progressName].map(item => [item.name, item]));
    
    updates.forEach(update => {
        dataMap.set(update.name, update);
    });
    
    let updatedData = Array.from(dataMap.values());
    progressData[progressName] = updatedData;
    
    const progressBar = document.querySelector(`.progress-bar[data-progress='${progressName}']`);
    const progressLegend = document.getElementById(`progressLegend-${progressName}`);
    progressBar.innerHTML = "";
    progressLegend.innerHTML = "";
    
    let totalUsed = updatedData.reduce((sum, section) => sum + section.value, 0);
    let totalPercentage = 0;
    
    updatedData.forEach(section => {
        let percentage = (section.value / totalValue) * 100;
        let div = document.createElement("div");
        div.classList.add("progress-section");
        div.style.width = percentage + "%";
        div.style.backgroundColor = section.color;
        progressBar.appendChild(div);
        totalPercentage += percentage;
        
        let legendItem = document.createElement("div");
        legendItem.classList.add("legend-item");
        
        let legendSwatch = document.createElement("div");
        legendSwatch.classList.add("legend-swatch");
        legendSwatch.style.backgroundColor = section.color;
        
        let legendText = document.createElement("span");
        legendText.textContent = `${section.name}: ${section.value}`;
        
        legendItem.appendChild(legendSwatch);
        legendItem.appendChild(legendText);
        progressLegend.appendChild(legendItem);
    });
    
    if (totalPercentage < 100) {
        let grayDiv = document.createElement("div");
        grayDiv.classList.add("progress-section");
        grayDiv.style.width = (100 - totalPercentage) + "%";
        grayDiv.style.backgroundColor = "#bbb";
        progressBar.appendChild(grayDiv);
    }
}


