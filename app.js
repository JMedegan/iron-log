// Iron Log - Main App
let currentDate = new Date().toISOString().split('T')[0];
let currentWorkout = null;
let currentExerciseId = null;
let exercises = [];
let volumeChart = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();
    exercises = await db.getAllExercises();
    
    setupNavigation();
    setupDatePicker();
    setupModals();
    setupExport();
    
    loadWorkout(currentDate);
    registerServiceWorker();
});

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(`${view}-view`).classList.add('active');
            
            if (view === 'history') loadHistory();
            if (view === 'stats') loadStats();
            if (view === 'exercises') loadExerciseList();
        });
    });
}

// Date Picker
function setupDatePicker() {
    const dateInput = document.getElementById('workoutDate');
    dateInput.value = currentDate;
    
    dateInput.addEventListener('change', (e) => {
        currentDate = e.target.value;
        loadWorkout(currentDate);
    });
    
    document.getElementById('prevDay').addEventListener('click', () => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() - 1);
        currentDate = date.toISOString().split('T')[0];
        dateInput.value = currentDate;
        loadWorkout(currentDate);
    });
    
    document.getElementById('nextDay').addEventListener('click', () => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + 1);
        currentDate = date.toISOString().split('T')[0];
        dateInput.value = currentDate;
        loadWorkout(currentDate);
    });
}

// Load workout for a date
async function loadWorkout(date) {
    currentWorkout = await db.getWorkoutByDate(date);
    
    if (!currentWorkout) {
        currentWorkout = { date, exercises: [] };
    }
    
    renderWorkout();
}

// Render workout
function renderWorkout() {
    const container = document.getElementById('workout-entries');
    
    if (!currentWorkout.exercises || currentWorkout.exercises.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>🏋️</span>
                <p>No exercises yet. Let's get to work!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = currentWorkout.exercises.map((exercise, exIndex) => `
        <div class="exercise-entry" data-index="${exIndex}">
            <div class="exercise-header">
                <span class="exercise-name">${exercise.name}</span>
                <div class="exercise-actions">
                    <button onclick="removeExercise(${exIndex})">🗑️</button>
                </div>
            </div>
            <div class="sets-list">
                ${exercise.sets.map((set, setIndex) => `
                    <div class="set-row">
                        <span class="set-number">${setIndex + 1}</span>
                        <span class="set-details">${set.weight} kg × ${set.reps}</span>
                        ${set.rpe ? `<span class="set-rpe">RPE ${set.rpe}</span>` : ''}
                        <button class="delete-set" onclick="removeSet(${exIndex}, ${setIndex})">✕</button>
                    </div>
                `).join('')}
            </div>
            <button class="add-set-btn" onclick="openSetModal(${exIndex})">+ Add Set</button>
        </div>
    `).join('');
}

// Modals
function setupModals() {
    // Exercise modal
    document.getElementById('addExercise').addEventListener('click', () => {
        openExerciseModal();
    });
    
    // Set modal steppers
    document.querySelectorAll('.stepper-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const delta = parseFloat(btn.dataset.delta);
            const input = btn.parentElement.querySelector('input');
            const newVal = parseFloat(input.value) + delta;
            if (newVal >= parseFloat(input.min || 0)) {
                input.value = newVal;
            }
        });
    });
    
    // RPE slider
    const rpeSlider = document.getElementById('setRPE');
    const rpeValue = document.getElementById('rpeValue');
    rpeSlider.addEventListener('input', () => {
        rpeValue.textContent = rpeSlider.value;
    });
    
    // Save set
    document.getElementById('saveSet').addEventListener('click', saveSet);
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
    
    // Close on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModals();
        });
    });
    
    // Exercise search in modal
    document.getElementById('modalExerciseSearch').addEventListener('input', (e) => {
        renderModalExercises(e.target.value);
    });
}

function openExerciseModal() {
    document.getElementById('exerciseModal').classList.add('active');
    document.getElementById('modalExerciseSearch').value = '';
    renderModalExercises('');
}

function renderModalExercises(filter) {
    const container = document.getElementById('modalExerciseList');
    const filtered = exercises.filter(ex => 
        ex.name.toLowerCase().includes(filter.toLowerCase())
    );
    
    // Group by muscle
    const grouped = filtered.reduce((acc, ex) => {
        if (!acc[ex.muscleGroup]) acc[ex.muscleGroup] = [];
        acc[ex.muscleGroup].push(ex);
        return acc;
    }, {});
    
    let html = '';
    for (const [group, exs] of Object.entries(grouped)) {
        html += `<div class="exercise-item muscle-group">${group}</div>`;
        html += exs.map(ex => `
            <div class="exercise-item" onclick="selectExercise('${ex.name}')">${ex.name}</div>
        `).join('');
    }
    
    container.innerHTML = html || '<p class="empty-state">No exercises found</p>';
}

function selectExercise(name) {
    if (!currentWorkout.exercises) {
        currentWorkout.exercises = [];
    }
    
    currentWorkout.exercises.push({
        name,
        sets: []
    });
    
    saveCurrentWorkout();
    closeModals();
    renderWorkout();
}

function openSetModal(exerciseIndex) {
    currentExerciseId = exerciseIndex;
    const exercise = currentWorkout.exercises[exerciseIndex];
    
    document.getElementById('setModalTitle').textContent = `Add Set - ${exercise.name}`;
    
    // Pre-fill with last set values if exists
    if (exercise.sets.length > 0) {
        const lastSet = exercise.sets[exercise.sets.length - 1];
        document.getElementById('setWeight').value = lastSet.weight;
        document.getElementById('setReps').value = lastSet.reps;
        if (lastSet.rpe) {
            document.getElementById('setRPE').value = lastSet.rpe;
            document.getElementById('rpeValue').textContent = lastSet.rpe;
        }
    }
    
    document.getElementById('setModal').classList.add('active');
}

function saveSet() {
    const weight = parseFloat(document.getElementById('setWeight').value);
    const reps = parseInt(document.getElementById('setReps').value);
    const rpe = parseFloat(document.getElementById('setRPE').value);
    
    if (isNaN(weight) || isNaN(reps) || weight < 0 || reps < 1) {
        alert('Please enter valid weight and reps');
        return;
    }
    
    const set = { weight, reps };
    if (rpe) set.rpe = rpe;
    
    currentWorkout.exercises[currentExerciseId].sets.push(set);
    saveCurrentWorkout();
    closeModals();
    renderWorkout();
}

function removeSet(exerciseIndex, setIndex) {
    currentWorkout.exercises[exerciseIndex].sets.splice(setIndex, 1);
    saveCurrentWorkout();
    renderWorkout();
}

function removeExercise(exerciseIndex) {
    if (confirm('Remove this exercise?')) {
        currentWorkout.exercises.splice(exerciseIndex, 1);
        saveCurrentWorkout();
        renderWorkout();
    }
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

async function saveCurrentWorkout() {
    await db.saveWorkout(currentWorkout);
}

// History view
async function loadHistory() {
    const workouts = await db.getAllWorkouts();
    const container = document.getElementById('history-list');
    
    if (workouts.length === 0) {
        container.innerHTML = '<div class="empty-state"><span>📅</span><p>No workout history yet</p></div>';
        return;
    }
    
    container.innerHTML = workouts.map(w => `
        <div class="history-day" onclick="goToDate('${w.date}')">
            <div class="history-date">${formatDate(w.date)}</div>
            ${w.exercises.map(ex => `
                <div class="history-exercise">
                    <div class="history-exercise-name">${ex.name}</div>
                    <div class="history-sets">${summarizeSets(ex.sets)}</div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function summarizeSets(sets) {
    if (!sets || sets.length === 0) return 'No sets';
    const maxWeight = Math.max(...sets.map(s => s.weight));
    const totalReps = sets.reduce((sum, s) => sum + s.reps, 0);
    return `${sets.length} sets • ${maxWeight} kg max • ${totalReps} total reps`;
}

function goToDate(date) {
    currentDate = date;
    document.getElementById('workoutDate').value = date;
    document.querySelector('[data-view="log"]').click();
    loadWorkout(date);
}

// Stats view
async function loadStats() {
    const workouts = await db.getAllWorkouts();
    
    // Total workouts
    document.getElementById('totalWorkouts').textContent = workouts.length;
    
    // This week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekWorkouts = workouts.filter(w => new Date(w.date) >= weekAgo);
    document.getElementById('weekWorkouts').textContent = weekWorkouts.length;
    
    // Total volume
    let totalVolume = 0;
    workouts.forEach(w => {
        w.exercises.forEach(ex => {
            ex.sets.forEach(s => {
                totalVolume += s.weight * s.reps;
            });
        });
    });
    document.getElementById('totalVolume').textContent = Math.round(totalVolume).toLocaleString();
    
    // Weekly volume chart
    renderVolumeChart(workouts);
    
    // PRs
    renderPRs(workouts);
}

function renderVolumeChart(workouts) {
    const ctx = document.getElementById('volumeChart').getContext('2d');
    
    // Get last 8 weeks
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        let volume = 0;
        workouts.forEach(w => {
            const wDate = new Date(w.date);
            if (wDate >= weekStart && wDate < weekEnd) {
                w.exercises.forEach(ex => {
                    ex.sets.forEach(s => {
                        volume += s.weight * s.reps;
                    });
                });
            }
        });
        
        weeks.push({
            label: `W${8 - i}`,
            volume
        });
    }
    
    if (volumeChart) volumeChart.destroy();
    
    volumeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weeks.map(w => w.label),
            datasets: [{
                label: 'Volume (kg)',
                data: weeks.map(w => w.volume),
                backgroundColor: '#e94560',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#16213e' },
                    ticks: { color: '#a0a0a0' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#a0a0a0' }
                }
            }
        }
    });
}

function renderPRs(workouts) {
    const prs = {};
    
    workouts.forEach(w => {
        w.exercises.forEach(ex => {
            ex.sets.forEach(s => {
                if (!prs[ex.name] || s.weight > prs[ex.name].weight) {
                    prs[ex.name] = {
                        weight: s.weight,
                        reps: s.reps,
                        date: w.date
                    };
                }
            });
        });
    });
    
    const container = document.getElementById('prs');
    const entries = Object.entries(prs).sort((a, b) => b[1].weight - a[1].weight);
    
    if (entries.length === 0) {
        container.innerHTML = '<p class="empty-state">Log some workouts to see PRs</p>';
        return;
    }
    
    container.innerHTML = entries.slice(0, 10).map(([name, pr]) => `
        <div class="pr-item">
            <span>${name}</span>
            <span class="pr-weight">${pr.weight} kg × ${pr.reps}</span>
        </div>
    `).join('');
}

// Exercise list view
async function loadExerciseList() {
    exercises = await db.getAllExercises();
    const container = document.getElementById('exercise-list');
    
    const grouped = exercises.reduce((acc, ex) => {
        if (!acc[ex.muscleGroup]) acc[ex.muscleGroup] = [];
        acc[ex.muscleGroup].push(ex);
        return acc;
    }, {});
    
    let html = '';
    for (const [group, exs] of Object.entries(grouped)) {
        html += `<div class="exercise-item muscle-group">${group}</div>`;
        html += exs.map(ex => `<div class="exercise-item">${ex.name}</div>`).join('');
    }
    
    container.innerHTML = html;
}

// Search exercises
document.getElementById('exerciseSearch').addEventListener('input', async (e) => {
    const filter = e.target.value.toLowerCase();
    exercises = await db.getAllExercises();
    const filtered = exercises.filter(ex => ex.name.toLowerCase().includes(filter));
    
    const container = document.getElementById('exercise-list');
    container.innerHTML = filtered.map(ex => `
        <div class="exercise-item">${ex.name} <span style="color: var(--text-muted)">(${ex.muscleGroup})</span></div>
    `).join('');
});

// Add custom exercise
document.getElementById('addCustomExercise').addEventListener('click', async () => {
    const name = prompt('Exercise name:');
    if (!name) return;
    
    const muscleGroup = prompt('Muscle group (Chest, Back, Legs, Shoulders, Arms):');
    if (!muscleGroup) return;
    
    try {
        await db.addExercise({ name, muscleGroup });
        exercises = await db.getAllExercises();
        loadExerciseList();
        alert('Exercise added!');
    } catch (e) {
        alert('Exercise already exists');
    }
});

// Export
function setupExport() {
    document.getElementById('exportBtn').addEventListener('click', async () => {
        const data = await db.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ironlog-${currentDate}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    });
}

// Service worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .catch(err => console.log('SW registration failed:', err));
    }
}
