// Initial State
let lists = JSON.parse(localStorage.getItem('aura_lists')) || [
  { id: '1', name: 'Personal', color: '#6366f1', icon: 'ph-user' },
  { id: '2', name: 'Work', color: '#f59e0b', icon: 'ph-briefcase' }
];

let tasks = JSON.parse(localStorage.getItem('aura_tasks')) || [
  { id: '101', listId: '1', title: 'Buy groceries', notes: 'Milk, Eggs, Bread, Avocados', priority: 'medium', completed: false, createdAt: Date.now() },
  { id: '102', listId: '2', title: 'Prepare Q3 Report', notes: 'Include the new financial metrics.', priority: 'high', completed: false, createdAt: Date.now() }
];

let currentListId = lists[0]?.id || null;
let currentPriorityFilter = 'all';

// Sync State
let ghToken = localStorage.getItem('aura_gh_token') || '';
let gistId = localStorage.getItem('aura_gist_id') || '';

// DOM Elements
const listsContainer = document.getElementById('lists-container');
const tasksContainer = document.getElementById('tasks-container');
const currentListTitle = document.getElementById('current-list-title');
const priorityFilters = document.getElementById('priority-filters');

// Modals
const taskModal = document.getElementById('task-modal');
const listModal = document.getElementById('list-modal');
const viewTaskModal = document.getElementById('view-task-modal');
const settingsModal = document.getElementById('settings-modal');

// Mobile Sidebar
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnMenu = document.getElementById('btn-menu');

// Buttons
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const btnNewList = document.getElementById('btn-new-list');
const btnEditList = document.getElementById('btn-edit-list');
const btnAddTask = document.getElementById('btn-add-task');
const btnSync = document.getElementById('btn-sync');
const closeButtons = document.querySelectorAll('.close-modal');

// Forms
const taskForm = document.getElementById('task-form');
const listForm = document.getElementById('list-form');
const settingsForm = document.getElementById('settings-form');

// Initialization
function init() {
  // Setup theme
  const savedTheme = localStorage.getItem('aura_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-theme');
  }
  
  // Try to sync on load if configured
  if (ghToken && gistId) {
    syncFromGist();
  } else {
    renderLists();
    renderTasks();
  }
  setupEventListeners();
}

// Data Management
function saveData(shouldSync = true) {
  localStorage.setItem('aura_lists', JSON.stringify(lists));
  localStorage.setItem('aura_tasks', JSON.stringify(tasks));
  if (shouldSync && ghToken) {
    syncToGist();
  }
}

// ---------------------------
// SYNC LOGIC (GitHub Gists)
// ---------------------------
async function syncToGist() {
  if (!ghToken) return;
  const statusEl = document.getElementById('sync-status');
  if(statusEl) statusEl.textContent = 'Syncing...';
  
  const payload = {
    lists: lists,
    tasks: tasks
  };

  const fileData = {
    "aura_sync_data.json": {
      content: JSON.stringify(payload, null, 2)
    }
  };

  try {
    let url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
    let method = gistId ? 'PATCH' : 'POST';

    const reqBody = {
      description: "Aura To-Do App Sync Data",
      files: fileData
    };

    if (!gistId) {
      reqBody.public = false; // Make it a private gist if creating
    }

    const res = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `token ${ghToken}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(reqBody)
    });

    if (!res.ok) throw new Error('Failed to sync. Check token permissions.');
    
    const data = await res.json();
    if (!gistId) {
      gistId = data.id;
      localStorage.setItem('aura_gist_id', gistId);
    }
    
    if(statusEl) statusEl.textContent = 'Synced successfully!';
    setTimeout(() => { if(statusEl) statusEl.textContent = ''; }, 3000);
  } catch (error) {
    console.error(error);
    if(statusEl) statusEl.textContent = 'Sync failed. Invalid token?';
  }
}

async function syncFromGist() {
  if (!ghToken || !gistId) return;
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${ghToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) throw new Error('Failed to fetch gist.');
    const data = await res.json();
    
    const fileContent = data.files['aura_sync_data.json']?.content;
    if (fileContent) {
      const parsed = JSON.parse(fileContent);
      if (parsed.lists && parsed.tasks) {
        lists = parsed.lists;
        tasks = parsed.tasks;
        
        // Ensure current list still exists
        if (!lists.find(l => l.id === currentListId)) {
          currentListId = lists[0]?.id || null;
        }
        
        // Save to local storage silently (without triggering syncToGist again)
        localStorage.setItem('aura_lists', JSON.stringify(lists));
        localStorage.setItem('aura_tasks', JSON.stringify(tasks));
        
        renderLists();
        renderTasks();
      }
    }
  } catch (error) {
    console.error('Error fetching from Gist:', error);
  }
}

// Rendering Lists
function renderLists() {
  listsContainer.innerHTML = '';
  lists.forEach(list => {
    const li = document.createElement('li');
    li.className = `list-item ${list.id === currentListId ? 'active' : ''}`;
    li.style.setProperty('--list-color', list.color);
    
    const taskCount = tasks.filter(t => t.listId === list.id && !t.completed).length;

    li.innerHTML = `
      <i class="ph ${list.icon || 'ph-list'}"></i>
      <span>${list.name}</span>
      <span class="task-count">${taskCount}</span>
    `;
    
    li.addEventListener('click', () => {
      currentListId = list.id;
      renderLists(); // Update active state
      renderTasks();
      closeMobileSidebar();
    });
    
    listsContainer.appendChild(li);
  });
  
  // Update Header based on current list
  const currentList = lists.find(l => l.id === currentListId);
  if (currentList) {
    currentListTitle.textContent = currentList.name;
    document.documentElement.style.setProperty('--accent-primary', currentList.color);
  } else {
    currentListTitle.textContent = "My Tasks";
    document.documentElement.style.setProperty('--accent-primary', '#6366f1');
  }
}

// Rendering Tasks
function renderTasks() {
  tasksContainer.innerHTML = '';
  
  let filteredTasks = tasks.filter(t => t.listId === currentListId);
  
  if (currentPriorityFilter !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.priority === currentPriorityFilter);
  }
  
  // Sort: Incomplete first, then by creation date
  filteredTasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return b.createdAt - a.createdAt;
  });

  if (filteredTasks.length === 0) {
    tasksContainer.innerHTML = `
      <div class="empty-state animate-slide-in">
        <i class="ph ph-check-circle"></i>
        <p>All clear! Nothing to do here.</p>
      </div>
    `;
    return;
  }

  filteredTasks.forEach((task, index) => {
    const el = document.createElement('div');
    el.className = `task-item animate-slide-in ${task.completed ? 'completed' : ''}`;
    el.style.animationDelay = `${index * 0.05}s`;
    
    const priorityHTML = task.priority !== 'none' 
      ? `<div class="priority-indicator priority-${task.priority}"></div>` 
      : '';

    el.innerHTML = `
      <label class="custom-checkbox">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <span class="checkmark"></span>
      </label>
      <div class="task-content">
        <div class="task-title">${task.title}</div>
        ${task.notes ? `<div class="task-subtitle">${task.notes}</div>` : ''}
      </div>
      ${priorityHTML}
    `;

    // Checkbox event
    const checkbox = el.querySelector('.task-checkbox');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      task.completed = e.target.checked;
      saveData();
      renderTasks();
      renderLists(); // Update counts
    });

    // View task event
    el.addEventListener('click', () => {
      openViewTaskModal(task);
    });

    tasksContainer.appendChild(el);
  });
}

// View Task Details
function openViewTaskModal(task) {
  const currentList = lists.find(l => l.id === task.listId);
  
  document.getElementById('view-task-list-name').textContent = currentList ? currentList.name : 'Unknown List';
  document.getElementById('view-task-title').textContent = task.title;
  
  const notesEl = document.getElementById('view-task-notes');
  if (task.notes) {
    notesEl.textContent = task.notes;
    notesEl.style.opacity = 1;
  } else {
    notesEl.textContent = "No notes provided.";
    notesEl.style.opacity = 0.5;
  }
  
  const priorityBadge = document.getElementById('view-task-priority');
  if (task.priority !== 'none') {
    priorityBadge.textContent = task.priority;
    priorityBadge.className = `priority-badge ${task.priority}`;
    priorityBadge.style.display = 'inline-block';
  } else {
    priorityBadge.style.display = 'none';
  }

  const checkbox = document.getElementById('view-task-checkbox');
  checkbox.checked = task.completed;
  checkbox.onchange = (e) => {
    task.completed = e.target.checked;
    saveData();
    renderTasks();
    renderLists();
  };

  // Setup Actions
  document.getElementById('btn-edit-task-full').onclick = () => {
    closeModal(viewTaskModal);
    openTaskModal(task);
  };

  document.getElementById('btn-delete-task-full').onclick = () => {
    if(confirm('Are you sure you want to delete this task?')) {
      tasks = tasks.filter(t => t.id !== task.id);
      saveData();
      closeModal(viewTaskModal);
      renderTasks();
      renderLists();
    }
  };

  openModal(viewTaskModal);
}

// Modals Setup
function openModal(modal) {
  modal.classList.remove('hidden');
}

function closeModal(modal) {
  modal.classList.add('hidden');
}

function openTaskModal(taskToEdit = null) {
  // Populate List options
  const listSelect = document.getElementById('task-list');
  listSelect.innerHTML = '';
  lists.forEach(l => {
    const option = document.createElement('option');
    option.value = l.id;
    option.textContent = l.name;
    if (l.id === currentListId) option.selected = true;
    listSelect.appendChild(option);
  });

  if (taskToEdit && !taskToEdit.type) { 
    document.getElementById('task-modal-title').textContent = "Edit Task";
    document.getElementById('task-id').value = taskToEdit.id;
    document.getElementById('task-title').value = taskToEdit.title;
    document.getElementById('task-notes').value = taskToEdit.notes || '';
    document.getElementById('task-priority').value = taskToEdit.priority || 'none';
    document.getElementById('task-list').value = taskToEdit.listId;
  } else {
    document.getElementById('task-modal-title').textContent = "New Task";
    taskForm.reset();
    document.getElementById('task-id').value = '';
    document.getElementById('task-list').value = currentListId;
  }
  openModal(taskModal);
}

function openListModal(listToEdit = null) {
  const colorPicker = document.getElementById('list-color-picker');
  const deleteBtn = document.getElementById('btn-delete-list');
  
  if (listToEdit && !listToEdit.type) {
    document.getElementById('list-modal-title').textContent = "Edit List";
    document.getElementById('list-id').value = listToEdit.id;
    document.getElementById('list-name').value = listToEdit.name;
    
    // Select color swatch
    Array.from(colorPicker.children).forEach(swatch => {
      if (swatch.dataset.color.toLowerCase() === listToEdit.color.toLowerCase()) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    });

    if (lists.length > 1) {
      deleteBtn.classList.remove('hidden');
      deleteBtn.onclick = () => {
        if(confirm('Delete this list and all its tasks?')) {
          tasks = tasks.filter(t => t.listId !== listToEdit.id);
          lists = lists.filter(l => l.id !== listToEdit.id);
          currentListId = lists[0].id;
          saveData();
          closeModal(listModal);
          renderLists();
          renderTasks();
        }
      };
    } else {
      deleteBtn.classList.add('hidden');
    }
  } else {
    document.getElementById('list-modal-title').textContent = "Create List";
    listForm.reset();
    document.getElementById('list-id').value = '';
    deleteBtn.classList.add('hidden');
    
    Array.from(colorPicker.children).forEach((swatch, index) => {
      swatch.classList.toggle('active', index === 0);
    });
  }
  openModal(listModal);
}

function openSettingsModal() {
  document.getElementById('github-token').value = ghToken || '';
  document.getElementById('gist-id').value = gistId || '';
  document.getElementById('sync-status').textContent = '';
  openModal(settingsModal);
}

// Mobile Sidebar Logic
function openMobileSidebar() {
  if (sidebar && sidebarOverlay) {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('visible');
  }
}

function closeMobileSidebar() {
  if (sidebar && sidebarOverlay) {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
  }
}

// Event Listeners Setup
function setupEventListeners() {
  btnThemeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('aura_theme', isDark ? 'dark' : 'light');
  });

  // Mobile Menu
  if(btnMenu) {
    btnMenu.addEventListener('click', openMobileSidebar);
  }
  if(sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeMobileSidebar);
  }

  // Filters
  priorityFilters.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentPriorityFilter = e.target.dataset.filter;
      renderTasks();
    }
  });

  // Buttons -> Modals
  btnAddTask.addEventListener('click', openTaskModal);
  btnNewList.addEventListener('click', openListModal);
  btnEditList.addEventListener('click', () => {
    const list = lists.find(l => l.id === currentListId);
    if (list) openListModal(list);
  });
  if(btnSync) {
    btnSync.addEventListener('click', () => {
      if (ghToken && gistId) {
        // Force a manual pull sync if already configured
        const statusEl = document.getElementById('sync-status');
        if(statusEl) statusEl.textContent = 'Pulling...';
        syncFromGist().then(() => {
          if(statusEl) statusEl.textContent = 'Pulled successfully.';
        });
      }
      openSettingsModal();
    });
  }

  closeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) closeModal(modal);
    });
  });

  // Color Picker Logic
  document.getElementById('list-color-picker').addEventListener('click', (e) => {
    if (e.target.classList.contains('color-swatch')) {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      e.target.classList.add('active');
    }
  });

  // Forms Submit
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value.trim();
    const notes = document.getElementById('task-notes').value.trim();
    const priority = document.getElementById('task-priority').value;
    const listId = document.getElementById('task-list').value;

    if (!title) return;

    if (id) {
      // Edit
      const taskIndex = tasks.findIndex(t => t.id === id);
      if (taskIndex > -1) {
        tasks[taskIndex] = { ...tasks[taskIndex], title, notes, priority, listId };
      }
    } else {
      // Add
      tasks.push({
        id: Date.now().toString(),
        title,
        notes,
        priority,
        listId,
        completed: false,
        createdAt: Date.now()
      });
    }

    saveData();
    closeModal(taskModal);
    if(listId !== currentListId) {
       currentListId = listId;
    }
    renderLists();
    renderTasks();
  });

  listForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('list-id').value;
    const name = document.getElementById('list-name').value.trim();
    const colorSwatch = document.querySelector('.color-swatch.active');
    
    let color = colorSwatch ? colorSwatch.dataset.color : '#6366f1';
    if(color.startsWith('var(')) color = '#6366f1';

    if (!name) return;

    if (id) {
      // Edit
      const listIndex = lists.findIndex(l => l.id === id);
      if (listIndex > -1) {
        lists[listIndex].name = name;
        lists[listIndex].color = color;
      }
    } else {
      // Add
      const newListId = Date.now().toString();
      lists.push({
        id: newListId,
        name,
        color,
        icon: 'ph-list'
      });
      currentListId = newListId;
    }

    saveData();
    closeModal(listModal);
    renderLists();
    renderTasks();
  });

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ghToken = document.getElementById('github-token').value.trim();
    gistId = document.getElementById('gist-id').value.trim();
    
    localStorage.setItem('aura_gh_token', ghToken);
    localStorage.setItem('aura_gist_id', gistId);
    
    const statusEl = document.getElementById('sync-status');
    statusEl.textContent = 'Saving...';
    
    if (ghToken && !gistId) {
      // Push first time to create
      await syncToGist();
      // gistId should now be populated
      document.getElementById('gist-id').value = gistId; 
    } else if (ghToken && gistId) {
      // Pull first time to get remote data
      await syncFromGist();
    }
    
    statusEl.textContent = 'Configuration Saved!';
    setTimeout(() => { closeModal(settingsModal); }, 1000);
  });
}

// Start
init();
