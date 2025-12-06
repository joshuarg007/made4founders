import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import {
  Plus, Search, LayoutGrid, Clock, MessageSquare,
  CheckCircle2, Circle, AlertCircle, Calendar, User, X,
  Trash2, Edit3, Play, Square,
  Send, Timer, History, Flag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getBoards, getTasks, createTask, updateTask, deleteTask, completeTask,
  reopenTask, moveTask, assignTask, getUsersList, getTaskComments,
  createComment, getTimeEntries, createTimeEntry, startTimer, stopTimer,
  getRunningTimer, getTaskActivity,
} from '../lib/api';
import type { TaskBoard, TaskColumn, Task, UserBrief, TaskComment, TimeEntry, TaskActivity } from '../lib/api';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  medium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  urgent: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const PRIORITY_ICONS: Record<string, React.ReactNode> = {
  low: <Flag className="w-3 h-3" />,
  medium: <Flag className="w-3 h-3" />,
  high: <Flag className="w-3 h-3 fill-current" />,
  urgent: <AlertCircle className="w-3 h-3" />,
};

export default function Tasks() {
  const { user, canEdit } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State
  const [boards, setBoards] = useState<TaskBoard[]>([]);
  const [currentBoard, setCurrentBoard] = useState<TaskBoard | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<number | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // Modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null);

  // Task form
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    assigned_to_id: null as number | null,
    column_id: null as number | null,
  });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentBoard) {
      loadTasks();
    }
  }, [currentBoard, showCompleted]);

  const loadData = async () => {
    try {
      const [boardsData, usersData] = await Promise.all([
        getBoards(),
        getUsersList(),
      ]);
      setBoards(boardsData);
      setUsers(usersData);
      if (boardsData.length > 0) {
        setCurrentBoard(boardsData[0]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    if (!currentBoard) return;
    try {
      const tasksData = await getTasks({
        board_id: currentBoard.id,
        include_completed: showCompleted,
      });
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  // Filter tasks
  const getFilteredTasks = (columnId: number) => {
    return tasks
      .filter(task => task.column_id === columnId)
      .filter(task => !searchQuery || task.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter(task => !filterAssignee || task.assigned_to_id === filterAssignee)
      .filter(task => !filterPriority || task.priority === filterPriority)
      .sort((a, b) => a.position - b.position);
  };

  // Drag and drop handler
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !canEdit) return;

    const { draggableId, destination } = result;
    const taskId = parseInt(draggableId);
    const targetColumnId = parseInt(destination.droppableId);
    const targetPosition = destination.index;

    // Optimistic update
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      const newTasks = prev.filter(t => t.id !== taskId);
      const updatedTask = {
        ...task,
        column_id: targetColumnId,
        position: targetPosition,
      };

      // Update positions
      const targetTasks = newTasks.filter(t => t.column_id === targetColumnId);
      targetTasks.forEach((t, i) => {
        if (i >= targetPosition) t.position = i + 1;
      });

      return [...newTasks, updatedTask].sort((a, b) => a.position - b.position);
    });

    try {
      await moveTask(taskId, targetColumnId, targetPosition);
      loadTasks(); // Refresh to get accurate positions
    } catch (error) {
      console.error('Failed to move task:', error);
      loadTasks(); // Revert on error
    }
  };

  // Task CRUD
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBoard || !taskForm.title.trim()) return;

    try {
      await createTask({
        board_id: currentBoard.id,
        title: taskForm.title,
        description: taskForm.description || undefined,
        priority: taskForm.priority,
        due_date: taskForm.due_date || undefined,
        assigned_to_id: taskForm.assigned_to_id || undefined,
        column_id: taskForm.column_id || currentBoard.columns[1]?.id, // Default to "To Do"
        status: 'todo',
      });
      setShowTaskModal(false);
      resetTaskForm();
      loadTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      await updateTask(editingTask.id, {
        title: taskForm.title,
        description: taskForm.description || null,
        priority: taskForm.priority,
        due_date: taskForm.due_date || null,
      });
      setShowTaskModal(false);
      setEditingTask(null);
      resetTaskForm();
      loadTasks();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(taskId);
      setSelectedTask(null);
      loadTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await completeTask(taskId);
      loadTasks();
      if (selectedTask?.id === taskId) {
        const updated = await getTasks({ board_id: currentBoard!.id, include_completed: true });
        setSelectedTask(updated.find(t => t.id === taskId) || null);
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleReopenTask = async (taskId: number) => {
    try {
      await reopenTask(taskId);
      loadTasks();
    } catch (error) {
      console.error('Failed to reopen task:', error);
    }
  };

  const handleAssignTask = async (taskId: number, userId: number | null) => {
    try {
      await assignTask(taskId, userId);
      loadTasks();
    } catch (error) {
      console.error('Failed to assign task:', error);
    }
  };

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      // Find the column that matches this status
      const targetColumn = currentBoard?.columns.find(c => c.status === newStatus);

      // Update task with new status and column
      await updateTask(taskId, {
        status: newStatus,
        column_id: targetColumn?.id || undefined,
      });

      // Show toast notification
      const statusLabels: Record<string, { label: string; color: string }> = {
        backlog: { label: 'Backlog', color: 'bg-gray-500' },
        todo: { label: 'To Do', color: 'bg-blue-500' },
        in_progress: { label: 'In Progress', color: 'bg-yellow-500' },
        done: { label: 'Done', color: 'bg-green-500' },
      };
      const statusInfo = statusLabels[newStatus] || { label: newStatus, color: 'bg-gray-500' };
      setToast({ message: `Moved to ${statusInfo.label}`, color: statusInfo.color });
      setTimeout(() => setToast(null), 2000);

      // Reload tasks
      loadTasks();

      // Update selectedTask to reflect the change
      if (selectedTask?.id === taskId) {
        const updated = await getTasks({ board_id: currentBoard!.id, include_completed: true });
        setSelectedTask(updated.find(t => t.id === taskId) || null);
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
      setToast({ message: 'Failed to update status', color: 'bg-red-500' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
      assigned_to_id: null,
      column_id: null,
    });
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      assigned_to_id: task.assigned_to_id,
      column_id: task.column_id,
    });
    setShowTaskModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-cyan-400" />
              Tasks
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Kanban board for managing tasks across your team
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => {
                resetTaskForm();
                setEditingTask(null);
                setShowTaskModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
            >
              <Plus className="w-5 h-5" />
              Add Task
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Board selector */}
          {boards.length > 1 && (
            <select
              value={currentBoard?.id || ''}
              onChange={(e) => {
                const board = boards.find(b => b.id === parseInt(e.target.value));
                setCurrentBoard(board || null);
              }}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              {boards.map(board => (
                <option key={board.id} value={board.id}>{board.name}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Priority filter */}
          <select
            value={filterPriority || ''}
            onChange={(e) => setFilterPriority(e.target.value || null)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Assignee filter */}
          <select
            value={filterAssignee || ''}
            onChange={(e) => setFilterAssignee(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
          >
            <option value="">All Assignees</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>

          {/* Show completed toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-white/20 bg-white/5"
            />
            Show completed
          </label>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full min-w-max">
            {currentBoard?.columns
              .sort((a, b) => a.position - b.position)
              .map(column => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={getFilteredTasks(column.id)}
                  onTaskClick={setSelectedTask}
                  onCompleteTask={handleCompleteTask}
                  canEdit={canEdit}
                />
              ))}
          </div>
        </div>
      </DragDropContext>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onComplete={handleCompleteTask}
          onReopen={handleReopenTask}
          onDelete={handleDeleteTask}
          onAssign={handleAssignTask}
          onStatusChange={handleStatusChange}
          onEdit={openEditModal}
          canEdit={canEdit}
          isAdmin={isAdmin}
        />
      )}

      {/* Create/Edit Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingTask ? 'Edit Task' : 'New Task'}
              </h2>
              <button onClick={() => { setShowTaskModal(false); setEditingTask(null); }}>
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            <form onSubmit={editingTask ? handleUpdateTask : handleCreateTask} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  placeholder="Task title"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 resize-none"
                  placeholder="Task description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
              {!editingTask && isAdmin && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Assign To</label>
                  <select
                    value={taskForm.assigned_to_id || ''}
                    onChange={(e) => setTaskForm({ ...taskForm, assigned_to_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>
              )}
              {!editingTask && currentBoard && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Column</label>
                  <select
                    value={taskForm.column_id || ''}
                    onChange={(e) => setTaskForm({ ...taskForm, column_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {currentBoard.columns.map(col => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowTaskModal(false); setEditingTask(null); }}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
                >
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`${toast.color} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2`}>
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Kanban Column Component
function KanbanColumn({
  column,
  tasks,
  onTaskClick,
  onCompleteTask,
  canEdit,
}: {
  column: TaskColumn;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onCompleteTask: (taskId: number) => void;
  canEdit: boolean;
}) {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-white/5 rounded-xl border border-white/10">
      {/* Column Header */}
      <div
        className="p-3 border-b border-white/10 flex items-center justify-between"
        style={{ borderTopColor: column.color || '#6b7280', borderTopWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{column.name}</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-gray-400">
            {tasks.length}
          </span>
        </div>
        {column.wip_limit && tasks.length >= column.wip_limit && (
          <span className="text-xs text-orange-400">WIP Limit</span>
        )}
      </div>

      {/* Tasks */}
      <Droppable droppableId={String(column.id)} isDropDisabled={!canEdit}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] ${
              snapshot.isDraggingOver ? 'bg-cyan-500/10' : ''
            }`}
          >
            {tasks.map((task, index) => (
              <Draggable
                key={task.id}
                draggableId={String(task.id)}
                index={index}
                isDragDisabled={!canEdit}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`${snapshot.isDragging ? 'opacity-80' : ''}`}
                  >
                    <TaskCard
                      task={task}
                      onClick={() => onTaskClick(task)}
                      onComplete={() => onCompleteTask(task.id)}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// Task Card Component
function TaskCard({
  task,
  onClick,
  onComplete,
}: {
  task: Task;
  onClick: () => void;
  onComplete: () => void;
}) {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';
  const isDueToday = task.due_date && isToday(new Date(task.due_date));

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg bg-[#1a1d24] border border-white/10 hover:border-white/20 cursor-pointer transition group ${
        task.status === 'done' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Complete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          className="mt-0.5 flex-shrink-0"
        >
          {task.status === 'done' ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <Circle className="w-5 h-5 text-gray-500 hover:text-cyan-400 transition" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium text-white truncate ${task.status === 'done' ? 'line-through' : ''}`}>
            {task.title}
          </h4>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Priority */}
            <span className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border ${PRIORITY_COLORS[task.priority]}`}>
              {PRIORITY_ICONS[task.priority]}
              {task.priority}
            </span>

            {/* Due date */}
            {task.due_date && (
              <span className={`flex items-center gap-1 text-xs ${
                isOverdue ? 'text-red-400' : isDueToday ? 'text-orange-400' : 'text-gray-500'
              }`}>
                <Calendar className="w-3 h-3" />
                {format(new Date(task.due_date), 'MMM d')}
              </span>
            )}

            {/* Time tracked */}
            {task.total_time_minutes && task.total_time_minutes > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                {Math.floor(task.total_time_minutes / 60)}h {task.total_time_minutes % 60}m
              </span>
            )}

            {/* Comments */}
            {task.comment_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MessageSquare className="w-3 h-3" />
                {task.comment_count}
              </span>
            )}
          </div>

          {/* Assignee */}
          {task.assigned_to && (
            <div className="flex items-center gap-1 mt-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-[10px] text-white font-medium">
                {(task.assigned_to.name || task.assigned_to.email)[0].toUpperCase()}
              </div>
              <span className="text-xs text-gray-400 truncate">
                {task.assigned_to.name || task.assigned_to.email}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Task Detail Modal Component
function TaskDetailPanel({
  task,
  users,
  onClose,
  onComplete,
  onReopen,
  onDelete,
  onAssign,
  onStatusChange,
  onEdit,
  canEdit,
  isAdmin,
}: {
  task: Task;
  users: UserBrief[];
  onClose: () => void;
  onComplete: (id: number) => void;
  onReopen: (id: number) => void;
  onDelete: (id: number) => void;
  onAssign: (taskId: number, userId: number | null) => void;
  onStatusChange: (taskId: number, status: string) => void;
  onEdit: (task: Task) => void;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [newComment, setNewComment] = useState('');
  const [runningTimer, setRunningTimer] = useState<TimeEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'comments' | 'time' | 'activity'>('comments');
  const [manualTime, setManualTime] = useState({ hours: 0, minutes: 0 });

  useEffect(() => {
    loadTaskDetails();
  }, [task.id]);

  const loadTaskDetails = async () => {
    try {
      const [commentsData, timeData, activityData] = await Promise.all([
        getTaskComments(task.id),
        getTimeEntries(task.id),
        getTaskActivity(task.id),
      ]);
      setComments(commentsData);
      setTimeEntries(timeData);
      setActivities(activityData);

      // Check for running timer
      try {
        const running = await getRunningTimer();
        if (running.task_id === task.id) {
          setRunningTimer(running);
        }
      } catch {
        setRunningTimer(null);
      }
    } catch (error) {
      console.error('Failed to load task details:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await createComment(task.id, newComment);
      setNewComment('');
      loadTaskDetails();
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleStartTimer = async () => {
    try {
      const entry = await startTimer(task.id);
      setRunningTimer(entry);
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  };

  const handleStopTimer = async () => {
    if (!runningTimer) return;
    try {
      await stopTimer(runningTimer.id);
      setRunningTimer(null);
      loadTaskDetails();
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
  };

  const handleAddManualTime = async () => {
    const totalMinutes = manualTime.hours * 60 + manualTime.minutes;
    if (totalMinutes <= 0) return;
    try {
      await createTimeEntry(task.id, totalMinutes);
      setManualTime({ hours: 0, minutes: 0 });
      loadTaskDetails();
    } catch (error) {
      console.error('Failed to add time entry:', error);
    }
  };

  const totalTime = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

  const STATUS_OPTIONS = [
    { value: 'backlog', label: 'Backlog', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
    { value: 'todo', label: 'To Do', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    { value: 'done', label: 'Done', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#1a1d24] rounded-xl border border-white/10 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-xs rounded border ${PRIORITY_COLORS[task.priority]}`}>
                {task.priority}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-white">{task.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => onEdit(task)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => onDelete(task.id)}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Selector */}
        <div className="px-5 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 mr-2">Status:</span>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.value}
                onClick={() => onStatusChange(task.id, status.value)}
                disabled={!canEdit && status.value !== 'done'}
                className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                  task.status === status.value
                    ? status.color + ' ring-2 ring-offset-2 ring-offset-[#1a1d24]'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                } ${!canEdit && status.value !== 'done' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Description */}
        {task.description && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Description</h3>
            <p className="text-white text-sm whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        {/* Details */}
        <div className="grid grid-cols-2 gap-4">
          {/* Due date */}
          {task.due_date && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-1">Due Date</h3>
              <p className="text-sm text-white flex items-center gap-1">
                <Calendar className="w-4 h-4 text-gray-500" />
                {format(new Date(task.due_date), 'MMM d, yyyy')}
              </p>
            </div>
          )}

          {/* Assignee */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 mb-1">Assignee</h3>
            {isAdmin ? (
              <select
                value={task.assigned_to_id || ''}
                onChange={(e) => onAssign(task.id, e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-2 py-1 text-sm rounded bg-white/5 border border-white/10 text-white"
              >
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-white flex items-center gap-1">
                <User className="w-4 h-4 text-gray-500" />
                {task.assigned_to?.name || task.assigned_to?.email || 'Unassigned'}
              </p>
            )}
          </div>

          {/* Created by */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 mb-1">Created by</h3>
            <p className="text-sm text-white">
              {task.created_by?.name || task.created_by?.email || 'Unknown'}
            </p>
          </div>

          {/* Total time */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 mb-1">Time Tracked</h3>
            <p className="text-sm text-white flex items-center gap-1">
              <Clock className="w-4 h-4 text-gray-500" />
              {Math.floor(totalTime / 60)}h {totalTime % 60}m
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/10">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('comments')}
              className={`pb-2 text-sm font-medium border-b-2 transition ${
                activeTab === 'comments'
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-gray-500 border-transparent hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Comments ({comments.length})
            </button>
            <button
              onClick={() => setActiveTab('time')}
              className={`pb-2 text-sm font-medium border-b-2 transition ${
                activeTab === 'time'
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-gray-500 border-transparent hover:text-white'
              }`}
            >
              <Timer className="w-4 h-4 inline mr-1" />
              Time
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`pb-2 text-sm font-medium border-b-2 transition ${
                activeTab === 'activity'
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-gray-500 border-transparent hover:text-white'
              }`}
            >
              <History className="w-4 h-4 inline mr-1" />
              Activity
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            {/* Comment input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={handleAddComment}
                className="px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Comments list */}
            {comments.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No comments yet</p>
            ) : (
              <div className="space-y-3">
                {comments.map(comment => (
                  <div key={comment.id} className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-[10px] text-white font-medium">
                        {(comment.user?.name || comment.user?.email || '?')[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white">
                        {comment.user?.name || comment.user?.email}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                      {comment.is_edited && (
                        <span className="text-xs text-gray-600">(edited)</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 pl-8">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'time' && (
          <div className="space-y-4">
            {/* Timer */}
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              {runningTimer ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Timer running</p>
                    <p className="text-lg font-mono text-cyan-400">
                      {formatDistanceToNow(new Date(runningTimer.started_at!))}
                    </p>
                  </div>
                  <button
                    onClick={handleStopTimer}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartTimer}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition"
                >
                  <Play className="w-4 h-4" />
                  Start Timer
                </button>
              )}
            </div>

            {/* Manual time entry */}
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-sm text-gray-400 mb-2">Add time manually</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={manualTime.hours}
                  onChange={(e) => setManualTime({ ...manualTime, hours: parseInt(e.target.value) || 0 })}
                  className="w-16 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-sm text-center"
                />
                <span className="text-gray-500 text-sm">h</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={manualTime.minutes}
                  onChange={(e) => setManualTime({ ...manualTime, minutes: parseInt(e.target.value) || 0 })}
                  className="w-16 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-sm text-center"
                />
                <span className="text-gray-500 text-sm">m</span>
                <button
                  onClick={handleAddManualTime}
                  className="px-3 py-1 rounded bg-cyan-500/20 text-cyan-300 text-sm hover:bg-cyan-500/30 transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Time entries list */}
            {timeEntries.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-400">Time Entries</h4>
                {timeEntries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-2 rounded bg-white/5">
                    <div>
                      <p className="text-sm text-white">
                        {entry.duration_minutes ? `${Math.floor(entry.duration_minutes / 60)}h ${entry.duration_minutes % 60}m` : 'Running...'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.user?.name || entry.user?.email} - {format(new Date(entry.created_at), 'MMM d')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No activity yet</p>
            ) : (
              activities.map(activity => (
                <div key={activity.id} className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-gray-400 font-medium flex-shrink-0">
                    {(activity.user?.name || activity.user?.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-gray-300">
                      <span className="font-medium text-white">
                        {activity.user?.name || activity.user?.email}
                      </span>{' '}
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#1a1d24] rounded-b-xl">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition"
            >
              Close
            </button>
            {task.status !== 'done' ? (
              <button
                onClick={() => onComplete(task.id)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition shadow-lg"
              >
                <CheckCircle2 className="w-5 h-5" />
                Complete Task
              </button>
            ) : canEdit ? (
              <button
                onClick={() => onReopen(task.id)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition"
              >
                <Circle className="w-5 h-5" />
                Reopen Task
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
