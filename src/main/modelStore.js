const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ModelStore {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'data');
    this.filePath = path.join(this.dataDir, 'models.json');
    this.models = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.models = JSON.parse(raw);
      } else {
        this.models = [];
      }
    } catch (e) {
      console.error('Failed to load models:', e);
      this.models = [];
    }
  }

  save() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.models, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save models:', e);
    }
  }

  getAll() {
    return this.models;
  }

  getById(id) {
    return this.models.find(m => m.id === id);
  }

  getDefault() {
    return this.models.find(m => m.isDefault) || this.models[0];
  }

  add(model) {
    model.id = 'model_' + Date.now();
    if (this.models.length === 0) model.isDefault = true;
    this.models.push(model);
    this.save();
    return model;
  }

  update(id, updates) {
    const model = this.getById(id);
    if (model) {
      Object.assign(model, updates);
      this.save();
    }
    return model;
  }

  remove(id) {
    const wasDefault = this.getById(id)?.isDefault;
    this.models = this.models.filter(m => m.id !== id);
    if (wasDefault && this.models.length > 0) {
      this.models[0].isDefault = true;
    }
    this.save();
  }

  setDefault(id) {
    this.models.forEach(m => m.isDefault = (m.id === id));
    this.save();
  }
}

module.exports = ModelStore;
