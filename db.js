// IndexedDB wrapper for Iron Log
const DB_NAME = 'IronLogDB';
const DB_VERSION = 1;

class IronDB {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Exercises store
                if (!db.objectStoreNames.contains('exercises')) {
                    const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
                    exerciseStore.createIndex('name', 'name', { unique: true });
                    exerciseStore.createIndex('muscleGroup', 'muscleGroup', { unique: false });
                    
                    // Seed default exercises
                    const defaults = [
                        // Chest
                        { name: 'Bench Press', muscleGroup: 'Chest' },
                        { name: 'Incline Bench Press', muscleGroup: 'Chest' },
                        { name: 'Decline Bench Press', muscleGroup: 'Chest' },
                        { name: 'Dumbbell Press', muscleGroup: 'Chest' },
                        { name: 'Incline Dumbbell Press', muscleGroup: 'Chest' },
                        { name: 'Dumbbell Fly', muscleGroup: 'Chest' },
                        { name: 'Cable Fly', muscleGroup: 'Chest' },
                        { name: 'Cable Crossover', muscleGroup: 'Chest' },
                        { name: 'Chest Dip', muscleGroup: 'Chest' },
                        { name: 'Push-up', muscleGroup: 'Chest' },
                        { name: 'Machine Chest Press', muscleGroup: 'Chest' },
                        { name: 'Pec Deck', muscleGroup: 'Chest' },
                        
                        // Back
                        { name: 'Deadlift', muscleGroup: 'Back' },
                        { name: 'Barbell Row', muscleGroup: 'Back' },
                        { name: 'Dumbbell Row', muscleGroup: 'Back' },
                        { name: 'Pull-up', muscleGroup: 'Back' },
                        { name: 'Chin-up', muscleGroup: 'Back' },
                        { name: 'Lat Pulldown', muscleGroup: 'Back' },
                        { name: 'Close Grip Lat Pulldown', muscleGroup: 'Back' },
                        { name: 'Seated Cable Row', muscleGroup: 'Back' },
                        { name: 'T-Bar Row', muscleGroup: 'Back' },
                        { name: 'Pendlay Row', muscleGroup: 'Back' },
                        { name: 'Meadows Row', muscleGroup: 'Back' },
                        { name: 'Chest Supported Row', muscleGroup: 'Back' },
                        { name: 'Rack Pull', muscleGroup: 'Back' },
                        { name: 'Good Morning', muscleGroup: 'Back' },
                        { name: 'Back Extension', muscleGroup: 'Back' },
                        { name: 'Straight Arm Pulldown', muscleGroup: 'Back' },
                        { name: 'Shrug', muscleGroup: 'Back' },
                        
                        // Legs
                        { name: 'Squat', muscleGroup: 'Legs' },
                        { name: 'Front Squat', muscleGroup: 'Legs' },
                        { name: 'Goblet Squat', muscleGroup: 'Legs' },
                        { name: 'Hack Squat', muscleGroup: 'Legs' },
                        { name: 'Leg Press', muscleGroup: 'Legs' },
                        { name: 'Romanian Deadlift', muscleGroup: 'Legs' },
                        { name: 'Stiff Leg Deadlift', muscleGroup: 'Legs' },
                        { name: 'Sumo Deadlift', muscleGroup: 'Legs' },
                        { name: 'Bulgarian Split Squat', muscleGroup: 'Legs' },
                        { name: 'Lunge', muscleGroup: 'Legs' },
                        { name: 'Walking Lunge', muscleGroup: 'Legs' },
                        { name: 'Step Up', muscleGroup: 'Legs' },
                        { name: 'Leg Curl', muscleGroup: 'Legs' },
                        { name: 'Seated Leg Curl', muscleGroup: 'Legs' },
                        { name: 'Leg Extension', muscleGroup: 'Legs' },
                        { name: 'Hip Thrust', muscleGroup: 'Legs' },
                        { name: 'Glute Bridge', muscleGroup: 'Legs' },
                        { name: 'Cable Kickback', muscleGroup: 'Legs' },
                        { name: 'Hip Abduction', muscleGroup: 'Legs' },
                        { name: 'Hip Adduction', muscleGroup: 'Legs' },
                        { name: 'Calf Raise', muscleGroup: 'Legs' },
                        { name: 'Seated Calf Raise', muscleGroup: 'Legs' },
                        
                        // Shoulders
                        { name: 'Overhead Press', muscleGroup: 'Shoulders' },
                        { name: 'Seated Dumbbell Press', muscleGroup: 'Shoulders' },
                        { name: 'Arnold Press', muscleGroup: 'Shoulders' },
                        { name: 'Push Press', muscleGroup: 'Shoulders' },
                        { name: 'Lateral Raise', muscleGroup: 'Shoulders' },
                        { name: 'Cable Lateral Raise', muscleGroup: 'Shoulders' },
                        { name: 'Front Raise', muscleGroup: 'Shoulders' },
                        { name: 'Rear Delt Fly', muscleGroup: 'Shoulders' },
                        { name: 'Face Pull', muscleGroup: 'Shoulders' },
                        { name: 'Upright Row', muscleGroup: 'Shoulders' },
                        { name: 'Machine Shoulder Press', muscleGroup: 'Shoulders' },
                        { name: 'Lu Raise', muscleGroup: 'Shoulders' },
                        
                        // Arms - Biceps
                        { name: 'Bicep Curl', muscleGroup: 'Arms' },
                        { name: 'Dumbbell Curl', muscleGroup: 'Arms' },
                        { name: 'Hammer Curl', muscleGroup: 'Arms' },
                        { name: 'Preacher Curl', muscleGroup: 'Arms' },
                        { name: 'Incline Dumbbell Curl', muscleGroup: 'Arms' },
                        { name: 'Concentration Curl', muscleGroup: 'Arms' },
                        { name: 'Cable Curl', muscleGroup: 'Arms' },
                        { name: 'EZ Bar Curl', muscleGroup: 'Arms' },
                        { name: 'Spider Curl', muscleGroup: 'Arms' },
                        
                        // Arms - Triceps
                        { name: 'Tricep Pushdown', muscleGroup: 'Arms' },
                        { name: 'Rope Pushdown', muscleGroup: 'Arms' },
                        { name: 'Skull Crusher', muscleGroup: 'Arms' },
                        { name: 'Close Grip Bench Press', muscleGroup: 'Arms' },
                        { name: 'Tricep Dip', muscleGroup: 'Arms' },
                        { name: 'Overhead Tricep Extension', muscleGroup: 'Arms' },
                        { name: 'Cable Overhead Extension', muscleGroup: 'Arms' },
                        { name: 'Diamond Push-up', muscleGroup: 'Arms' },
                        { name: 'Tricep Kickback', muscleGroup: 'Arms' },
                        
                        // Arms - Forearms
                        { name: 'Wrist Curl', muscleGroup: 'Arms' },
                        { name: 'Reverse Wrist Curl', muscleGroup: 'Arms' },
                        { name: 'Farmers Walk', muscleGroup: 'Arms' },
                        
                        // Core
                        { name: 'Plank', muscleGroup: 'Core' },
                        { name: 'Crunch', muscleGroup: 'Core' },
                        { name: 'Cable Crunch', muscleGroup: 'Core' },
                        { name: 'Hanging Leg Raise', muscleGroup: 'Core' },
                        { name: 'Leg Raise', muscleGroup: 'Core' },
                        { name: 'Ab Wheel Rollout', muscleGroup: 'Core' },
                        { name: 'Russian Twist', muscleGroup: 'Core' },
                        { name: 'Woodchop', muscleGroup: 'Core' },
                        { name: 'Dead Bug', muscleGroup: 'Core' },
                        { name: 'Bird Dog', muscleGroup: 'Core' },
                        { name: 'Pallof Press', muscleGroup: 'Core' },
                        { name: 'Decline Sit-up', muscleGroup: 'Core' },
                    ];
                    
                    request.transaction.objectStore('exercises').transaction.oncomplete = () => {
                        const tx = db.transaction('exercises', 'readwrite');
                        defaults.forEach(ex => tx.objectStore('exercises').add(ex));
                    };
                }

                // Workouts store
                if (!db.objectStoreNames.contains('workouts')) {
                    const workoutStore = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
                    workoutStore.createIndex('date', 'date', { unique: false });
                }
            };
        });
    }

    // Exercise methods
    async getAllExercises() {
        return this._getAll('exercises');
    }

    async addExercise(exercise) {
        return this._add('exercises', exercise);
    }

    // Workout methods
    async getWorkoutByDate(date) {
        const tx = this.db.transaction('workouts', 'readonly');
        const store = tx.objectStore('workouts');
        const index = store.index('date');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(date);
            request.onsuccess = () => resolve(request.result[0] || null);
            request.onerror = () => reject(request.error);
        });
    }

    async saveWorkout(workout) {
        const existing = await this.getWorkoutByDate(workout.date);
        if (existing) {
            workout.id = existing.id;
            return this._put('workouts', workout);
        }
        return this._add('workouts', workout);
    }

    async getAllWorkouts() {
        const workouts = await this._getAll('workouts');
        return workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async deleteWorkout(id) {
        return this._delete('workouts', id);
    }

    // Export all data
    async exportData() {
        const exercises = await this.getAllExercises();
        const workouts = await this.getAllWorkouts();
        return {
            exportedAt: new Date().toISOString(),
            exercises,
            workouts
        };
    }

    // Import data
    async importData(data) {
        if (data.exercises) {
            for (const ex of data.exercises) {
                try {
                    await this.addExercise({ name: ex.name, muscleGroup: ex.muscleGroup });
                } catch (e) {
                    // Ignore duplicates
                }
            }
        }
        if (data.workouts) {
            for (const w of data.workouts) {
                delete w.id; // Remove old IDs
                await this.saveWorkout(w);
            }
        }
    }

    // Helper methods
    _getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const request = tx.objectStore(storeName).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _add(storeName, item) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const request = tx.objectStore(storeName).add(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _put(storeName, item) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const request = tx.objectStore(storeName).put(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const request = tx.objectStore(storeName).delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Global instance
const db = new IronDB();
