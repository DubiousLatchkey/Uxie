class GreenSquareTracker {
    constructor(trackerId, monthLabelId) {
        this.trackerContainer = document.getElementById(trackerId);
        this.monthLabelsContainer = document.getElementById(monthLabelId);
        this.squares = new Map();
        this.columns = 52;
        this.startDate = null;
        this.initializeStartDate();
    }

    initializeStartDate() {
        const today = new Date();
        // Calculate the starting Sunday by moving back enough weeks
        const dayOffset = today.getDay();
        today.setDate(today.getDate() - dayOffset - (this.columns - 1) * 7);
        this.startDate = new Date(today);
    }

    initialize() {
        // Clear existing tracker and month labels
        this.trackerContainer.innerHTML = '';
        this.monthLabelsContainer.innerHTML = '';
        this.squares.clear();

        // Create tracker grid squares in vertical order:
        // Outer loop over days (rows), inner loop over weeks (columns)
        for (let d = 0; d < 7; d++) {
            for (let w = 0; w < this.columns; w++) {
                const date = new Date(this.startDate);
                date.setDate(this.startDate.getDate() + d + w * 7);
                const dateString = date.toLocaleDateString('sv-SE').split('T')[0];
                const square = document.createElement('div');
                square.classList.add('square');
                square.setAttribute('data-date', dateString);
                square.setAttribute('data-count', '0');
                this.trackerContainer.appendChild(square);
                this.squares.set(dateString, square);
            }
        }

        // Prepare month labels for each week column.
        // Determine if the first month (from the very first Sunday) has at least 2 weeks.
        const firstMonth = new Date(this.startDate).toLocaleString('default', { month: 'short' });
        let countForFirstMonth = 0;
        for (let w = 0; w < this.columns; w++) {
            const date = new Date(this.startDate);
            date.setDate(this.startDate.getDate() + w * 7);
            const currentMonth = date.toLocaleString('default', { month: 'short' });
            if (currentMonth === firstMonth) {
                countForFirstMonth++;
            } else {
                break;
            }
        }

        const monthLabels = new Array(this.columns).fill('');
        let lastMonth = null;
        for (let w = 0; w < this.columns; w++) {
            const date = new Date(this.startDate);
            date.setDate(this.startDate.getDate() + w * 7);
            const month = date.toLocaleString('default', { month: 'short' });
            // For the very first week, skip labeling if the first month has fewer than 2 weeks
            if (w === 0 && month === firstMonth && countForFirstMonth < 2) {
                lastMonth = month;
                continue;
            }
            if (month !== lastMonth) {
                monthLabels[w] = month;
                lastMonth = month;
            }
        }

        // Populate the month labels grid
        monthLabels.forEach(labelText => {
            const labelCell = document.createElement('div');
            labelCell.textContent = labelText;
            this.monthLabelsContainer.appendChild(labelCell);
        });
    }

    updateSquare(date, count) {
        const dateString = date.toLocaleDateString('sv-SE').split('T')[0];
        if (this.squares.has(dateString)) {
            const square = this.squares.get(dateString);
            // Remove any existing level classes
            for (let i = 0; i <= 4; i++) {
                square.classList.remove(`level-${i}`);
            }
            // Set the full (actual) count for display
            square.setAttribute('data-count', count);
            // Determine effective level (capped at 4) for background color.
            const effectiveLevel = count > 0 ? Math.min(4, count) : 0;
            square.classList.add(`level-${effectiveLevel}`);
        }
    }

    modifySquare(date, delta) {
        const dateString = date.toLocaleDateString('sv-SE').split('T')[0];
        if (this.squares.has(dateString)) {
            const square = this.squares.get(dateString);
            let currentCount = parseInt(square.getAttribute('data-count')) || 0;
            let newCount = currentCount + delta;
            newCount = newCount < 0 ? 0 : newCount;
            this.updateSquare(date, newCount);
        }
    }
    /** 
   * Uses a Map for setting multiple squares at once.
   * @param {Map} mapData - A Map where keys are date strings "YYYY-MM-DD" and values are counts (0-4).
   */
    setSquaresFromMap(mapData) {
        if (!(mapData instanceof Map)) {
            console.error("Invalid data type: Expected a Map.");
            return;
        }

        for (const [dateStr, count] of mapData) {
            const date = new Date(dateStr);
            this.updateSquare(date, count);
        }
    }

}