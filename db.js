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
                        { name: 'Bench Press', muscleGroup: 'Chest' },
                        { name: 'Incline Dumbbell Press', muscleGroup: 'Chest' },
                        { name: 'Cable Fly', muscleGroup: 'Chest' },
                        { name: 'Squat', muscleGroup: 'Legs' },
                        { name: 'Leg Press', muscleGroup: 'Legs' },
                        { name: 'Romanian Deadlift', muscleGroup: 'Legs' },
                        { name: 'Leg Curl', muscleGroup: 'Legs' },
                        { name: 'Leg Extension', muscleGroup: 'Legs' },
                        { name: 'Calf Raise', muscleGroup: 'Legs' },
                        { name: 'Deadlift', muscleGroup: 'Back' },
                        { name: 'Barbell Row', muscleGroup: 'Back' },
                        { name: 'Pull-up', muscleGroup: 'Back' },
                        { name: 'Lat Pulldown', muscleGroup: 'Back' },
                        { name: 'Seated Cable Row', muscleGroup: 'Back' },
                        { name: 'Overhead Press', muscleGroup: 'Shoulders' },
                        { name: 'Lateral Raise', muscleGroup: 'Shoulders' },
                        { name: 'Face Pull', muscleGroup: 'Shoulders' },
                        { name: 'Bicep Curl', muscleGroup: 'Arms' },
                        { name: 'Hammer Curl', muscleGroup: 'Arms' },
                        { name: 'Tricep Pushdown', muscleGroup: 'Arms' },
                        { name: 'Skull Crusher', muscleGroup: 'Arms' },
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
