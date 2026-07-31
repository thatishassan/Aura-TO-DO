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
const btnClearCompleted = document.getElementById('btn-clear-completed');
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
      reqBody.public = false; 
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
        
        if (!lists.find(l => l.id === currentListId)) {
          currentListId = lists[0]?.id || null;
        }
        
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

// Helpers
function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T${timeStr || '00:00'}`);
  return d.toLocaleString(undefined, { 
    month: 'short', day: 'numeric', 
    hour: timeStr ? 'numeric' : undefined, 
    minute: timeStr ? '2-digit' : undefined 
  });
}

function isOverdue(dateStr, timeStr) {
  if (!dateStr) return false;
  const target = new Date(`${dateStr}T${timeStr || '23:59'}`);
  return target < new Date();
}

// Rendering Lists
function renderLists() {
  listsContainer.innerHTML = '';
  lists.forEach(list => {
    const li = document.createElement('li');
    li.className = `list-item ${list.id === currentListId ? 'active' : ''}`;
    li.style.setProperty('--list-color', list.color);
    li.dataset.id = list.id;
    li.draggable = true;
    
    const taskCount = tasks.filter(t => t.listId === list.id && !t.completed).length;

    li.innerHTML = `
      <div class="drag-handle" style="margin-right: 8px;"><i class="ph ph-dots-six-vertical"></i></div>
      <i class="ph ${list.icon || 'ph-list'}"></i>
      <span style="flex-grow: 1;">${list.name}</span>
      <span class="task-count">${taskCount}</span>
    `;
    
    li.addEventListener('click', (e) => {
      // Don't trigger if clicked on drag handle
      if (e.target.closest('.drag-handle')) return;
      currentListId = list.id;
      renderLists();
      renderTasks();
      closeMobileSidebar();
    });

    // Drag events for lists
    li.addEventListener('dragstart', () => {
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      saveListOrder();
    });
    
    listsContainer.appendChild(li);
  });
  
  // List Container Drag Over
  listsContainer.addEventListener('dragover', e => {
    e.preventDefault();
    const afterElement = getDragAfterElement(listsContainer, e.clientY);
    const draggable = document.querySelector('.list-item.dragging');
    if (draggable) {
      if (afterElement == null) {
        listsContainer.appendChild(draggable);
      } else {
        listsContainer.insertBefore(draggable, afterElement);
      }
    }
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

function saveListOrder() {
  const listEls = [...listsContainer.querySelectorAll('.list-item')];
  const newLists = [];
  listEls.forEach(el => {
    const found = lists.find(l => l.id === el.dataset.id);
    if(found) newLists.push(found);
  });
  if(newLists.length === lists.length) {
    lists = newLists;
    saveData();
  }
}

// Rendering Tasks
function renderTasks() {
  tasksContainer.innerHTML = '';
  
  let filteredTasks = tasks.filter(t => t.listId === currentListId);
  
  if (currentPriorityFilter !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.priority === currentPriorityFilter);
  }
  
  // We keep the manual order, but force completed tasks to the bottom
  const incompleteTasks = filteredTasks.filter(t => !t.completed);
  const completedTasks = filteredTasks.filter(t => t.completed);
  const displayTasks = [...incompleteTasks, ...completedTasks];

  // Show/Hide clear completed button
  if(completedTasks.length > 0) {
    btnClearCompleted.classList.remove('hidden');
  } else {
    btnClearCompleted.classList.add('hidden');
  }

  if (displayTasks.length === 0) {
    tasksContainer.innerHTML = `
      <div class="empty-state animate-slide-in">
        <i class="ph ph-check-circle"></i>
        <p>All clear! Nothing to do here.</p>
      </div>
    `;
    return;
  }

  displayTasks.forEach((task, index) => {
    const el = document.createElement('div');
    el.className = `task-item animate-slide-in ${task.completed ? 'completed' : ''}`;
    el.style.animationDelay = `${index * 0.05}s`;
    el.dataset.id = task.id;
    
    // Only allow drag and drop if filter is 'all'
    if (currentPriorityFilter === 'all') {
      el.draggable = true;
      el.addEventListener('dragstart', () => {
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        saveTaskOrder();
      });
    }

    const priorityHTML = task.priority !== 'none' 
      ? `<div class="priority-indicator priority-${task.priority}"></div>` 
      : '';
      
    let dateTimeHTML = '';
    if (task.dueDate) {
      const formatted = formatDateTime(task.dueDate, task.dueTime);
      const overdueClass = (!task.completed && isOverdue(task.dueDate, task.dueTime)) ? 'overdue' : '';
      dateTimeHTML = `<div class="datetime-badge ${overdueClass}" style="margin-top:4px;"><i class="ph ph-calendar"></i> ${formatted}</div>`;
    }

    el.innerHTML = `
      ${currentPriorityFilter === 'all' ? '<div class="drag-handle"><i class="ph ph-dots-six-vertical"></i></div>' : ''}
      <label class="custom-checkbox">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <span class="checkmark"></span>
      </label>
      <div class="task-content">
        <div class="task-title">${task.title}</div>
        ${task.notes ? `<div class="task-subtitle">${task.notes}</div>` : ''}
        ${dateTimeHTML}
      </div>
      ${priorityHTML}
    `;

    // Prevent click on checkbox from opening the modal
    const checkboxLabel = el.querySelector('.custom-checkbox');
    checkboxLabel.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Checkbox event
    const checkbox = el.querySelector('.task-checkbox');
    checkbox.addEventListener('change', (e) => {
      task.completed = e.target.checked;
      saveData();
      renderTasks();
      renderLists(); // Update counts
    });

    // View task event
    el.addEventListener('click', (e) => {
      if (e.target.closest('.drag-handle')) return;
      openViewTaskModal(task);
    });

    tasksContainer.appendChild(el);
  });
  
  // Tasks Container Drag Over
  if (currentPriorityFilter === 'all') {
    tasksContainer.addEventListener('dragover', e => {
      e.preventDefault();
      const afterElement = getDragAfterElement(tasksContainer, e.clientY);
      const draggable = document.querySelector('.task-item.dragging');
      if (draggable) {
        if (afterElement == null) {
          tasksContainer.appendChild(draggable);
        } else {
          tasksContainer.insertBefore(draggable, afterElement);
        }
      }
    });
  }
}

function saveTaskOrder() {
  const taskEls = [...tasksContainer.querySelectorAll('.task-item')];
  const newOrderIds = taskEls.map(el => el.dataset.id);
  
  // Reconstruct tasks array based on the new visual order for current list
  const currentListTasks = newOrderIds.map(id => tasks.find(t => t.id === id)).filter(Boolean);
  const otherTasks = tasks.filter(t => t.listId !== currentListId);
  
  tasks = [...currentListTasks, ...otherTasks];
  saveData();
  renderTasks(); // Re-render to ensure completed tasks still fall to bottom logic applies correctly visually
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(':scope > div:not(.dragging), :scope > li:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
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
  
  const dtBadge = document.getElementById('view-task-datetime');
  if (task.dueDate) {
    const formatted = formatDateTime(task.dueDate, task.dueTime);
    const overdueClass = (!task.completed && isOverdue(task.dueDate, task.dueTime)) ? 'overdue' : '';
    dtBadge.querySelector('.dt-text').textContent = formatted;
    dtBadge.className = `datetime-badge ${overdueClass}`;
    dtBadge.style.display = 'inline-flex';
  } else {
    dtBadge.style.display = 'none';
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
    document.getElementById('task-date').value = taskToEdit.dueDate || '';
    document.getElementById('task-time').value = taskToEdit.dueTime || '';
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

  // Bulk Delete
  if(btnClearCompleted) {
    btnClearCompleted.addEventListener('click', () => {
      if(confirm('Are you sure you want to permanently delete all completed tasks in this list?')) {
        tasks = tasks.filter(t => !(t.listId === currentListId && t.completed));
        saveData();
        renderTasks();
        renderLists();
      }
    });
  }

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
    const dueDate = document.getElementById('task-date').value;
    const dueTime = document.getElementById('task-time').value;

    if (!title) return;

    if (id) {
      // Edit
      const taskIndex = tasks.findIndex(t => t.id === id);
      if (taskIndex > -1) {
        tasks[taskIndex] = { ...tasks[taskIndex], title, notes, priority, listId, dueDate, dueTime };
      }
    } else {
      // Add
      tasks.push({
        id: Date.now().toString(),
        title,
        notes,
        priority,
        listId,
        dueDate,
        dueTime,
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
      await syncToGist();
      document.getElementById('gist-id').value = gistId; 
    } else if (ghToken && gistId) {
      await syncFromGist();
    }
    
    statusEl.textContent = 'Configuration Saved!';
    setTimeout(() => { closeModal(settingsModal); }, 1000);
  });
}

// Start
init();
