// Iron Log - Professional Workout Tracker
let currentPlan = null;
let currentDayIndex = 0;
let currentDate = new Date().toISOString().split('T')[0];
let currentWorkout = null;
let currentExerciseIndex = null;
let exercises = [];
let volumeChart = null;
let restTimer = null;
let restSeconds = 60;
let editingSet = null; // Track if we're editing a set
let wakeLock = null; // Keep screen awake during timer

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();
    exercises = await db.getAllExercises();
    
    await loadPlan();
    setupNavigation();
    setupDaySelector();
    setupModals();
    setupExport();
    setupSettings();
    
    loadWorkoutForDay();
    registerServiceWorker();
});

// Load training plan
async function loadPlan() {
    try {
        const response = await fetch('plans/fat-loss-muscle.json');
        currentPlan = await response.json();
        populateDaySelector();
    } catch (e) {
        console.error('Failed to load plan:', e);
    }
}

function populateDaySelector() {
    const select = document.getElementById('daySelect');
    select.innerHTML = currentPlan.days
        .filter(d => d.exercises.length > 0)
        .map((day, idx) => {
            const realIdx = currentPlan.days.indexOf(day);
            return `<option value="${realIdx}">${day.day}: ${day.name}</option>`;
        }).join('');
}

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
            if (view === 'settings') loadExerciseList();
        });
    });
}

// Day Selector
function setupDaySelector() {
    const select = document.getElementById('daySelect');
    const dateInput = document.getElementById('workoutDate');
    
    dateInput.value = currentDate;
    
    select.addEventListener('change', () => {
        currentDayIndex = parseInt(select.value);
        loadWorkoutForDay();
    });
    
    dateInput.addEventListener('change', (e) => {
        currentDate = e.target.value;
        loadWorkoutForDay();
    });
}

// Load workout for selected day
async function loadWorkoutForDay() {
    if (!currentPlan) return;
    
    const dayPlan = currentPlan.days[currentDayIndex];
    
    // Set warmup
    document.getElementById('warmup-text').textContent = dayPlan.warmup || 'No specific warmup';
    
    // Set finisher
    const finisherCard = document.getElementById('finisher-card');
    if (dayPlan.finisher) {
        finisherCard.style.display = 'flex';
        document.getElementById('finisher-text').textContent = dayPlan.finisher;
    } else {
        finisherCard.style.display = 'none';
    }
    
    // Load saved workout data for this date
    currentWorkout = await db.getWorkoutByDate(currentDate);
    if (!currentWorkout) {
        currentWorkout = { 
            date: currentDate, 
            dayIndex: currentDayIndex,
            dayName: dayPlan.name,
            exercises: dayPlan.exercises.map(ex => ({
                name: ex.name,
                planId: ex.id,
                prescription: `${ex.sets} × ${ex.reps}`,
                notes: ex.notes,
                restTime: parseInt(ex.rest) || 60,
                targetSets: ex.sets,
                sets: []
            }))
        };
    }
    
    renderWorkout();
}

// Plate Calculator - Calculate plates needed for a target weight
function calculatePlates(targetWeight) {
    // Assuming Olympic bar (20kg) and standard plate pairs
    const barWeight = 20;
    if (targetWeight <= barWeight) return 'Bar only';
    
    let remaining = (targetWeight - barWeight) / 2; // Per side
    const plates = [];
    const availablePlates = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
    
    for (const plate of availablePlates) {
        while (remaining >= plate) {
            plates.push(plate);
            remaining -= plate;
        }
    }
    
    if (plates.length === 0) return 'Bar only';
    
    // Group plates
    const grouped = {};
    plates.forEach(p => grouped[p] = (grouped[p] || 0) + 1);
    
    return Object.entries(grouped)
        .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
        .map(([weight, count]) => `${weight}kg×${count}`)
        .join(' + ');
}

// Render workout
function renderWorkout() {
    const container = document.getElementById('workout-exercises');
    
    container.innerHTML = currentWorkout.exercises.map((exercise, exIndex) => {
        const doneSets = exercise.sets.length;
        const targetSets = exercise.targetSets || 4;
        
        return `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-info">
                        <div class="exercise-id">${exercise.planId}</div>
                        <div class="exercise-name">${exercise.name}</div>
                        <div class="exercise-prescription">${exercise.prescription} • Rest ${exercise.restTime}s</div>
                        ${exercise.notes ? `<div class="exercise-notes">${exercise.notes}</div>` : ''}
                    </div>
                    <div class="exercise-progress">
                        <div class="progress-dots">
                            ${Array(targetSets).fill(0).map((_, i) => 
                                `<div class="progress-dot ${i < doneSets ? 'done' : ''}"></div>`
                            ).join('')}
                        </div>
                    </div>
                </div>
                <div class="sets-container">
                    ${exercise.sets.map((set, setIndex) => `
                        <div class="logged-set" onclick="openEditModal(${exIndex}, ${setIndex})">
                            <div class="set-number">${setIndex + 1}</div>
                            <div class="set-details">${set.weight} kg × ${set.reps}</div>
                            ${set.rpe ? `<div class="set-rpe">RPE ${set.rpe}</div>` : ''}
                            <button class="delete-set" onclick="event.stopPropagation(); deleteSet(${exIndex}, ${setIndex})">✕</button>
                        </div>
                        ${set.weight > 20 ? `<div class="plate-calc"><span class="plate-calc-icon">🏋️</span><span class="plate-calc-text">${calculatePlates(set.weight)}</span></div>` : ''}
                    `).join('')}
                    <button class="add-set-btn" onclick="openSetModal(${exIndex})">+ Log Set</button>
                </div>
            </div>
        `;
    }).join('');
}

// Modals
function setupModals() {
    // Steppers
    document.querySelectorAll('.stepper-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const inputId = btn.dataset.input;
            const delta = parseFloat(btn.dataset.delta);
            const input = document.getElementById(inputId);
            const newVal = parseFloat(input.value) + delta;
            if (newVal >= parseFloat(input.min || 0)) {
                input.value = newVal;
            }
        });
    });
    
    // RPE buttons
    document.querySelectorAll('.rpe-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rpe-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Save set
    document.getElementById('saveSet').addEventListener('click', saveSet);
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
    
    // Backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModals();
        });
    });
    
    // Rest timer buttons
    document.querySelectorAll('.rest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            restSeconds += parseInt(btn.dataset.add);
            if (restSeconds < 0) restSeconds = 0;
            document.getElementById('restTime').textContent = restSeconds;
        });
    });
    
    document.getElementById('skipRest').addEventListener('click', () => {
        clearInterval(restTimer);
        closeModals();
    });
    
    // Complete workout
    document.getElementById('completeWorkout').addEventListener('click', completeWorkout);
}

function openSetModal(exerciseIndex) {
    editingSet = null; // New set, not editing
    currentExerciseIndex = exerciseIndex;
    const exercise = currentWorkout.exercises[exerciseIndex];
    
    document.getElementById('setModalTitle').textContent = exercise.name;
    document.getElementById('saveSet').textContent = 'Save Set';
    
    // Show last set values or previous workout
    const historyDiv = document.getElementById('setHistory');
    if (exercise.sets.length > 0) {
        const lastSet = exercise.sets[exercise.sets.length - 1];
        historyDiv.innerHTML = `<strong>Last set:</strong> ${lastSet.weight} kg × ${lastSet.reps}`;
        document.getElementById('setWeight').value = lastSet.weight;
        document.getElementById('setReps').value = lastSet.reps;
        if (lastSet.rpe) {
            document.querySelectorAll('.rpe-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.rpe == lastSet.rpe);
            });
        }
    } else {
        historyDiv.innerHTML = `<strong>Target:</strong> ${exercise.prescription}`;
        document.getElementById('setWeight').value = 20;
        document.getElementById('setReps').value = 10;
        document.querySelectorAll('.rpe-btn').forEach(b => b.classList.remove('active'));
    }
    
    document.getElementById('setModal').classList.add('active');
}

function openEditModal(exerciseIndex, setIndex) {
    editingSet = { exerciseIndex, setIndex };
    currentExerciseIndex = exerciseIndex;
    const exercise = currentWorkout.exercises[exerciseIndex];
    const set = exercise.sets[setIndex];
    
    document.getElementById('setModalTitle').textContent = `Edit Set ${setIndex + 1} - ${exercise.name}`;
    document.getElementById('saveSet').textContent = 'Update Set';
    
    document.getElementById('setWeight').value = set.weight;
    document.getElementById('setReps').value = set.reps;
    document.getElementById('setHistory').innerHTML = '<strong>Editing this set</strong>';
    
    // Set RPE if exists
    document.querySelectorAll('.rpe-btn').forEach(b => {
        b.classList.toggle('active', set.rpe && b.dataset.rpe == set.rpe);
    });
    
    document.getElementById('setModal').classList.add('active');
}

function saveSet() {
    const weight = parseFloat(document.getElementById('setWeight').value);
    const reps = parseInt(document.getElementById('setReps').value);
    const activeRpe = document.querySelector('.rpe-btn.active');
    const rpe = activeRpe ? parseInt(activeRpe.dataset.rpe) : null;
    
    if (isNaN(weight) || isNaN(reps) || weight < 0 || reps < 1) {
        alert('Enter valid weight and reps');
        return;
    }
    
    if (editingSet) {
        // Update existing set
        const set = currentWorkout.exercises[editingSet.exerciseIndex].sets[editingSet.setIndex];
        set.weight = weight;
        set.reps = reps;
        if (rpe) set.rpe = rpe;
        else delete set.rpe;
        set.editedAt = Date.now();
    } else {
        // Add new set
        const set = { weight, reps, timestamp: Date.now() };
        if (rpe) set.rpe = rpe;
        currentWorkout.exercises[currentExerciseIndex].sets.push(set);
    }
    
    saveCurrentWorkout();
    closeModals();
    renderWorkout();
    
    // Start rest timer only for new sets
    if (!editingSet) {
        const exercise = currentWorkout.exercises[currentExerciseIndex];
        restSeconds = exercise.restTime;
        startRestTimer();
    }
    
    editingSet = null;
}

// Audio context for timer beep
let audioContext = null;

function playBeep() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.5;
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake lock acquired');
        }
    } catch (err) {
        console.log('Wake lock not available:', err);
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
        console.log('Wake lock released');
    }
}

function startRestTimer() {
    document.getElementById('restTime').textContent = restSeconds;
    document.getElementById('restModal').classList.add('active');
    
    // Keep screen awake
    requestWakeLock();
    
    // Play initial beep
    playBeep();
    
    // Handle page visibility changes
    let hiddenTime = null;
    const handleVisibilityChange = () => {
        if (document.hidden) {
            hiddenTime = Date.now();
        } else if (hiddenTime) {
            // Page became visible again - adjust timer
            const elapsed = Math.floor((Date.now() - hiddenTime) / 1000);
            restSeconds = Math.max(0, restSeconds - elapsed);
            document.getElementById('restTime').textContent = restSeconds;
            hiddenTime = null;
            
            if (restSeconds <= 0) {
                clearInterval(restTimer);
                finishRestTimer();
            }
        }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    restTimer = setInterval(() => {
        restSeconds--;
        document.getElementById('restTime').textContent = restSeconds;
        
        // Beep at 10, 5, 4, 3, 2, 1 seconds
        if (restSeconds <= 10 && restSeconds > 0) {
            playBeep();
        }
        
        if (restSeconds <= 0) {
            clearInterval(restTimer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            finishRestTimer();
        }
    }, 1000);
}

function finishRestTimer() {
    // Final beep pattern
    playBeep();
    setTimeout(playBeep, 200);
    setTimeout(playBeep, 400);
    
    // Vibrate if supported
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    
    releaseWakeLock();
    closeModals();
}

function deleteSet(exerciseIndex, setIndex) {
    currentWorkout.exercises[exerciseIndex].sets.splice(setIndex, 1);
    saveCurrentWorkout();
    renderWorkout();
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    if (restTimer) {
        clearInterval(restTimer);
        restTimer = null;
    }
    releaseWakeLock();
    editingSet = null;
}

async function saveCurrentWorkout() {
    await db.saveWorkout(currentWorkout);
}

function completeWorkout() {
    const totalSets = currentWorkout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    
    if (totalSets === 0) {
        alert('Log at least one set before completing!');
        return;
    }
    
    currentWorkout.completed = true;
    currentWorkout.completedAt = Date.now();
    saveCurrentWorkout();
    
    alert(`💪 Workout complete!\n\n${totalSets} sets logged.`);
}

// History
async function loadHistory() {
    const workouts = await db.getAllWorkouts();
    const container = document.getElementById('history-list');
    
    if (workouts.length === 0) {
        container.innerHTML = '<div class="empty-state"><span>📅</span><p>No workout history yet</p></div>';
        return;
    }
    
    container.innerHTML = workouts.map(w => `
        <div class="history-day">
            <div class="history-date">${formatDate(w.date)} — ${w.dayName || 'Workout'}</div>
            ${w.exercises.filter(ex => ex.sets.length > 0).map(ex => `
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
    const setStrs = sets.map(s => `${s.weight}×${s.reps}`);
    return setStrs.join(' | ');
}

// Stats
async function loadStats() {
    const workouts = await db.getAllWorkouts();
    
    document.getElementById('totalWorkouts').textContent = workouts.filter(w => w.completed).length;
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    document.getElementById('weekWorkouts').textContent = 
        workouts.filter(w => new Date(w.date) >= weekAgo && w.completed).length;
    
    let totalVolume = 0;
    workouts.forEach(w => {
        w.exercises.forEach(ex => {
            ex.sets.forEach(s => {
                totalVolume += s.weight * s.reps;
            });
        });
    });
    document.getElementById('totalVolume').textContent = Math.round(totalVolume).toLocaleString();
    
    renderVolumeChart(workouts);
    renderPRs(workouts);
}

function renderVolumeChart(workouts) {
    const ctx = document.getElementById('volumeChart').getContext('2d');
    
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
        
        weeks.push({ label: `W${8 - i}`, volume });
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
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#16213e' }, ticks: { color: '#a0a0a0' } },
                x: { grid: { display: false }, ticks: { color: '#a0a0a0' } }
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
                    prs[ex.name] = { weight: s.weight, reps: s.reps, date: w.date };
                }
            });
        });
    });
    
    const container = document.getElementById('prs');
    const entries = Object.entries(prs).sort((a, b) => b[1].weight - a[1].weight);
    
    if (entries.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted)">Log workouts to see PRs</p>';
        return;
    }
    
    container.innerHTML = entries.slice(0, 10).map(([name, pr]) => `
        <div class="pr-item">
            <span>${name}</span>
            <span class="pr-weight">${pr.weight} kg × ${pr.reps}</span>
        </div>
    `).join('');
}

// Settings
function setupSettings() {
    document.getElementById('addCustomExercise').addEventListener('click', async () => {
        const name = prompt('Exercise name:');
        if (!name) return;
        const muscleGroup = prompt('Muscle group (Chest, Back, Legs, Shoulders, Arms, Core):');
        if (!muscleGroup) return;
        
        try {
            await db.addExercise({ name, muscleGroup });
            exercises = await db.getAllExercises();
            loadExerciseList();
        } catch (e) {
            alert('Exercise already exists');
        }
    });
    
    document.getElementById('resetExercises').addEventListener('click', async () => {
        if (!confirm('Reset to default exercises?')) return;
        await db.resetExercises();
        exercises = await db.getAllExercises();
        loadExerciseList();
    });
    
    document.getElementById('exerciseSearch').addEventListener('input', (e) => {
        loadExerciseList(e.target.value);
    });
}

async function loadExerciseList(filter = '') {
    exercises = await db.getAllExercises();
    const filtered = exercises.filter(ex => 
        ex.name.toLowerCase().includes(filter.toLowerCase())
    );
    
    const grouped = filtered.reduce((acc, ex) => {
        if (!acc[ex.muscleGroup]) acc[ex.muscleGroup] = [];
        acc[ex.muscleGroup].push(ex);
        return acc;
    }, {});
    
    const container = document.getElementById('exercise-list');
    let html = '';
    for (const [group, exs] of Object.entries(grouped)) {
        html += `<div class="exercise-item muscle-group">${group}</div>`;
        html += exs.map(ex => `<div class="exercise-item">${ex.name}</div>`).join('');
    }
    
    container.innerHTML = html || '<p style="color: var(--text-muted); padding: 20px;">No exercises found</p>';
}

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

// Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .catch(err => console.log('SW registration failed:', err));
    }
}
