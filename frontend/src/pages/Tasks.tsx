import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import {
  Plus, Search, LayoutGrid, Clock, MessageSquare,
  CheckCircle2, Circle, AlertCircle, Calendar, User, X,
  Trash2, Edit3, Play, Square, Save,
  Send, Timer, History, Flag, CalendarDays, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Link2, Copy, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { playXPSound } from '../lib/sounds';
import {
  getBoards, getTasks, createTask, updateTask, deleteTask, completeTask,
  moveTask, assignTask, getUsersList, getTaskComments,
  createComment, getTimeEntries, createTimeEntry, startTimer, stopTimer,
  getRunningTimer, getTaskActivity, getCalendarToken, generateCalendarToken,
  getCalendarFeedUrl,
} from '../lib/api';
import type { TaskBoard, TaskColumn, Task, UserBrief, TaskComment, TimeEntry, TaskActivity } from '../lib/api';
import { format, formatDistanceToNow, isPast, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

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
  const [showCompleted, setShowCompleted] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'calendar'>('kanban');

  // Modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null);

  // Calendar sync modal
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

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
        due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : undefined,
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
        due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
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
    // Find the task to get its title for confirmation
    const task = tasks.find(t => t.id === taskId);
    const taskTitle = task?.title || 'this task';

    // Confirm before completing
    if (!window.confirm(`Mark "${taskTitle}" as complete?`)) {
      return;
    }

    try {
      await completeTask(taskId);
      playXPSound(); // Play XP gain sound
      loadTasks();
      if (selectedTask?.id === taskId) {
        const updated = await getTasks({ board_id: currentBoard!.id, include_completed: true });
        setSelectedTask(updated.find(t => t.id === taskId) || null);
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
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

  // Calendar sync functions
  const loadCalendarToken = async () => {
    try {
      const data = await getCalendarToken();
      setCalendarToken(data.calendar_token);
    } catch (error) {
      console.error('Failed to load calendar token:', error);
    }
  };

  const handleGenerateToken = async () => {
    setCalendarLoading(true);
    try {
      const data = await generateCalendarToken();
      setCalendarToken(data.calendar_token);
      setToast({ message: 'Calendar URL generated!', color: 'bg-green-500' });
      setTimeout(() => setToast(null), 2000);
    } catch (error) {
      console.error('Failed to generate calendar token:', error);
      setToast({ message: 'Failed to generate URL', color: 'bg-red-500' });
      setTimeout(() => setToast(null), 2000);
    } finally {
      setCalendarLoading(false);
    }
  };

  const copyCalendarUrl = () => {
    if (calendarToken) {
      navigator.clipboard.writeText(getCalendarFeedUrl(calendarToken));
      setToast({ message: 'Copied to clipboard!', color: 'bg-green-500' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const openCalendarModal = async () => {
    setShowCalendarModal(true);
    await loadCalendarToken();
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
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'kanban'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Board
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'calendar'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Calendar
              </button>
            </div>

            {/* Calendar Sync button */}
            <button
              onClick={openCalendarModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition"
              title="Sync with Google Calendar"
            >
              <Link2 className="w-4 h-4" />
              <span className="text-sm">Sync</span>
            </button>

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
                <option key={board.id} value={board.id} className="bg-[#1a1d24] text-white">{board.name}</option>
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
            <option value="" className="bg-[#1a1d24] text-white">All Priorities</option>
            <option value="urgent" className="bg-[#1a1d24] text-white">Urgent</option>
            <option value="high" className="bg-[#1a1d24] text-white">High</option>
            <option value="medium" className="bg-[#1a1d24] text-white">Medium</option>
            <option value="low" className="bg-[#1a1d24] text-white">Low</option>
          </select>

          {/* Assignee filter */}
          <select
            value={filterAssignee || ''}
            onChange={(e) => setFilterAssignee(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
          >
            <option value="" className="bg-[#1a1d24] text-white">All Assignees</option>
            {users.map(u => (
              <option key={u.id} value={u.id} className="bg-[#1a1d24] text-white">{u.name || u.email}</option>
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
      {viewMode === 'kanban' && (
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
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && currentBoard && (
        <CalendarView
          tasks={tasks}
          backlogColumn={currentBoard.columns.find(c => c.status === 'backlog')}
          onTaskClick={setSelectedTask}
          onCompleteTask={handleCompleteTask}
          searchQuery={searchQuery}
          filterAssignee={filterAssignee}
          filterPriority={filterPriority}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onSave={() => {
            loadData();
            setSelectedTask(null);
          }}
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
                    <option value="low" className="bg-[#1a1d24] text-white">Low</option>
                    <option value="medium" className="bg-[#1a1d24] text-white">Medium</option>
                    <option value="high" className="bg-[#1a1d24] text-white">High</option>
                    <option value="urgent" className="bg-[#1a1d24] text-white">Urgent</option>
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
                    <option value="" className="bg-[#1a1d24] text-white">Unassigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id} className="bg-[#1a1d24] text-white">{u.name || u.email}</option>
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
                      <option key={col.id} value={col.id} className="bg-[#1a1d24] text-white">{col.name}</option>
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

      {/* Calendar Sync Modal */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCalendarModal(false)}>
          <div
            className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-cyan-400" />
                Calendar Sync
              </h2>
              <button onClick={() => setShowCalendarModal(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-gray-400 text-sm">
                Subscribe to your tasks and deadlines in Google Calendar, Apple Calendar, Outlook, or any app that supports iCal feeds.
              </p>

              {calendarToken ? (
                <div className="space-y-3">
                  <label className="block text-sm text-gray-400">Your Calendar URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getCalendarFeedUrl(calendarToken)}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono truncate"
                    />
                    <button
                      onClick={copyCalendarUrl}
                      className="px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition flex items-center gap-1"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={handleGenerateToken}
                      disabled={calendarLoading}
                      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
                    >
                      <RefreshCw className={`w-4 h-4 ${calendarLoading ? 'animate-spin' : ''}`} />
                      Regenerate URL
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm mb-4">
                    Generate a subscription URL to sync your calendar
                  </p>
                  <button
                    onClick={handleGenerateToken}
                    disabled={calendarLoading}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition flex items-center gap-2 mx-auto"
                  >
                    {calendarLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Link2 className="w-4 h-4" />
                    )}
                    Generate URL
                  </button>
                </div>
              )}

              <div className="pt-4 border-t border-white/10">
                <h3 className="text-sm font-medium text-white mb-2">How to subscribe:</h3>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li><span className="text-cyan-400">Google Calendar:</span> Settings &gt; Add calendar &gt; From URL</li>
                  <li><span className="text-cyan-400">Apple Calendar:</span> File &gt; New Calendar Subscription</li>
                  <li><span className="text-cyan-400">Outlook:</span> Add calendar &gt; Subscribe from web</li>
                </ul>
              </div>
            </div>
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';
  const isDueToday = task.due_date && isToday(new Date(task.due_date));

  // Collapsed view - single strip
  if (isCollapsed) {
    return (
      <div
        className={`px-3 py-2 rounded-lg bg-[#1a1d24] border border-white/10 hover:border-white/20 cursor-pointer transition flex items-center gap-2 ${
          task.status === 'done' ? 'opacity-60' : ''
        }`}
      >
        {/* Complete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          className="flex-shrink-0"
        >
          {task.status === 'done' ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <Circle className="w-4 h-4 text-gray-500 hover:text-cyan-400 transition" />
          )}
        </button>

        {/* Title - clickable to open detail */}
        <span
          onClick={onClick}
          className={`flex-1 text-sm text-white truncate ${task.status === 'done' ? 'line-through' : ''}`}
        >
          {task.title}
        </span>

        {/* Priority indicator */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          task.priority === 'urgent' ? 'bg-red-500' :
          task.priority === 'high' ? 'bg-orange-500' :
          task.priority === 'medium' ? 'bg-blue-500' : 'bg-gray-500'
        }`} />

        {/* Due date indicator if overdue */}
        {isOverdue && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}

        {/* Expand button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(false);
          }}
          className="flex-shrink-0 p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Expanded view - full card
  return (
    <div
      className={`p-3 rounded-lg bg-[#1a1d24] border border-white/10 hover:border-white/20 cursor-pointer transition group ${
        task.status === 'done' ? 'opacity-60' : ''
      }`}
    >
      {/* Header with collapse button */}
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

        <div className="flex-1 min-w-0" onClick={onClick}>
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

        {/* Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(true);
          }}
          className="flex-shrink-0 p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition opacity-0 group-hover:opacity-100"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Task Detail Modal Component
function TaskDetailPanel({
  task,
  users,
  onClose,
  onSave,
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
  onSave: () => void;
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
        if (running && running.task_id === task.id) {
          setRunningTimer(running);
        } else {
          setRunningTimer(null);
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
                <option value="" className="bg-[#1a1d24] text-white">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-[#1a1d24] text-white">{u.name || u.email}</option>
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
              Cancel
            </button>
            {canEdit && (
              <button
                onClick={onSave}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-600 transition shadow-lg"
              >
                <Save className="w-5 h-5" />
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Calendar View Component
function CalendarView({
  tasks,
  backlogColumn,
  onTaskClick,
  onCompleteTask,
  searchQuery,
  filterAssignee,
  filterPriority,
}: {
  tasks: Task[];
  backlogColumn?: TaskColumn;
  onTaskClick: (task: Task) => void;
  onCompleteTask: (taskId: number) => void;
  searchQuery: string;
  filterAssignee: number | null;
  filterPriority: string | null;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Filter tasks
  const filteredTasks = tasks
    .filter(task => !searchQuery || task.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(task => !filterAssignee || task.assigned_to_id === filterAssignee)
    .filter(task => !filterPriority || task.priority === filterPriority);

  // Get backlog tasks (only tasks in backlog column)
  const backlogTasks = filteredTasks.filter(
    task => task.column_id === backlogColumn?.id
  );

  // Get tasks with due dates for calendar (exclude backlog)
  const calendarTasks = filteredTasks.filter(task => task.due_date && task.column_id !== backlogColumn?.id);

  // Get tasks for a specific day
  const getTasksForDay = (day: Date) => {
    return calendarTasks.filter(task =>
      task.due_date && isSameDay(new Date(task.due_date), day)
    );
  };

  // Calendar navigation
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Backlog Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-white/10 flex flex-col bg-white/5">
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-500" />
              Backlog
            </h3>
            <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-gray-400">
              {backlogTasks.length}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {backlogTasks.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No backlog tasks</p>
          ) : (
            backlogTasks.map(task => (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                className={`p-2.5 rounded-lg bg-[#1a1d24] border border-white/10 hover:border-white/20 cursor-pointer transition ${
                  task.status === 'done' ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCompleteTask(task.id);
                    }}
                    className="mt-0.5 flex-shrink-0"
                  >
                    {task.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-500 hover:text-cyan-400 transition" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm text-white truncate ${task.status === 'done' ? 'line-through' : ''}`}>
                      {task.title}
                    </h4>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border mt-1 ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition"
            >
              Today
            </button>
            <button
              onClick={prevMonth}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-cols-7 gap-1 auto-rows-fr overflow-hidden">
          {calendarDays.map(day => {
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isSameDay(day, new Date());
            const hasOverdue = dayTasks.some(t => isPast(new Date(t.due_date!)) && t.status !== 'done');

            return (
              <div
                key={day.toISOString()}
                className={`rounded-lg border overflow-hidden flex flex-col ${
                  isCurrentMonth
                    ? 'bg-white/5 border-white/10'
                    : 'bg-white/[0.02] border-white/5'
                } ${isCurrentDay ? 'ring-2 ring-cyan-500/50' : ''}`}
              >
                {/* Day number */}
                <div className={`px-2 py-1 text-right ${
                  isCurrentDay
                    ? 'bg-cyan-500/20'
                    : hasOverdue
                    ? 'bg-red-500/10'
                    : ''
                }`}>
                  <span className={`text-xs font-medium ${
                    isCurrentMonth
                      ? isCurrentDay
                        ? 'text-cyan-300'
                        : 'text-gray-300'
                      : 'text-gray-600'
                  }`}>
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Tasks */}
                <div className="flex-1 p-1 overflow-y-auto space-y-1">
                  {dayTasks.slice(0, 3).map(task => (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`px-1.5 py-1 rounded text-xs cursor-pointer truncate transition ${
                        task.status === 'done'
                          ? 'bg-green-500/20 text-green-300 line-through'
                          : isPast(new Date(task.due_date!))
                          ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                      }`}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
