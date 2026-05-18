import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView, Pressable,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { useTasks, Category, Task } from '../hooks/useTasks';
import { PixelButton } from '../components/PixelButton';
import { PixelCheckbox } from '../components/PixelCheckbox';
import { PixelInput } from '../components/PixelInput';
import { PixelModal } from '../components/PixelModal';
import { C, COLOR_PRESETS } from '../constants/colors';

// ── Date helpers ────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dateToStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getStreak(task: Task) {
  const worked = new Set(task.datesWorked);
  if (worked.size === 0) return 0;
  let streak = 0;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  while (worked.has(dateToStr(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

// ── Category tab ─────────────────────────────────────────────────
function CatTab({ cat, tasks, active, onPress, onEdit, onDelete }: {
  cat: Category; tasks: Task[]; active: boolean;
  onPress: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const done  = tasks.filter(t => t.completed).length;
  const total = tasks.length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={() => Alert.alert(cat.name, 'Edit or delete?', [
        { text: 'Edit', onPress: onEdit },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
        { text: 'Cancel', style: 'cancel' },
      ])}
      style={[styles.catTab, active && { borderColor: cat.color, shadowColor: cat.color }]}
    >
      <View style={styles.catTabHead}>
        <View style={[styles.catDot, { backgroundColor: cat.color }]} />
        <Text style={[styles.catTabName, active && styles.catTabNameActive]} numberOfLines={1}>{cat.name}</Text>
      </View>
      <Text style={[styles.catTabStats, active && styles.catTabStatsActive]}>{done}/{total} · {pct}%</Text>
      <View style={styles.catTabTrack}>
        <View style={[styles.catTabFill, { width: `${pct}%` as any, backgroundColor: cat.color }]} />
      </View>
    </TouchableOpacity>
  );
}

// ── Task row ──────────────────────────────────────────────────────
function TaskRow({ task, cat, onToggle, onEdit, onLog, onDelete }: {
  task: Task; cat?: Category;
  onToggle: () => void; onEdit: () => void; onLog: () => void; onDelete: () => void;
}) {
  const color       = cat?.color ?? '#666';
  const loggedToday = task.datesWorked.includes(todayStr());
  const streak      = loggedToday ? getStreak(task) : 0;

  return (
    <View style={[styles.taskItem, { borderLeftColor: color }, task.completed && styles.taskDone]}>
      <PixelCheckbox checked={task.completed} onPress={onToggle} />
      <TouchableOpacity style={styles.taskBody} onPress={onEdit} activeOpacity={0.7}>
        <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={styles.taskMeta}>
          <View style={[styles.catBadge, { backgroundColor: color }]}>
            <Text style={styles.catBadgeText}>{cat?.name ?? '?'}</Text>
          </View>
          <Text style={styles.daysBadge}>⏱ {task.datesWorked.length}d</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.taskActions}>
        <View style={styles.ptsBadge}>
          <Text style={styles.ptsBadgeText}>★ {task.points}</Text>
        </View>
        <TouchableOpacity
          onPress={onLog}
          style={[styles.logBtn, loggedToday && styles.logBtnLogged]}
        >
          <Text style={[styles.logBtnText, loggedToday && styles.logBtnTextLogged]}>
            {loggedToday ? `✓${streak}d` : '+LOG'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.delBtn}>
          <Text style={styles.delBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Color picker ──────────────────────────────────────────────────
function ColorPicker({ selected, onSelect }: { selected: string; onSelect: (c: string) => void }) {
  return (
    <View style={styles.colorGrid}>
      {COLOR_PRESETS.map(c => (
        <Pressable
          key={c}
          onPress={() => onSelect(c)}
          style={[styles.swatch, { backgroundColor: c }, selected === c && styles.swatchSel]}
        />
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────
type Props = { session: Session; onSignOut: () => void };

export function HomeScreen({ session, onSignOut }: Props) {
  const { categories, tasks, loading, load,
          addCategory, updateCategory, deleteCategory,
          addTask, updateTask, toggleTask, toggleWorkDay, deleteTask } = useTasks(session.user.id);

  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Category modal
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [editingCatId, setEditingCatId]       = useState<string | null>(null);
  const [catName, setCatName]                 = useState('');
  const [catColor, setCatColor]               = useState(COLOR_PRESETS[0]);

  // Task modal
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId]       = useState<string | null>(null);
  const [taskTitle, setTaskTitle]               = useState('');
  const [taskCatId, setTaskCatId]               = useState('');
  const [taskPoints, setTaskPoints]             = useState('1');

  useEffect(() => { load(); }, [load]);

  // ── Category modal helpers ──
  const openNewCat = () => {
    setEditingCatId(null);
    setCatName('');
    setCatColor(COLOR_PRESETS[categories.length % COLOR_PRESETS.length]);
    setCatModalVisible(true);
  };

  const openEditCat = (cat: Category) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatColor(cat.color);
    setCatModalVisible(true);
  };

  const saveCat = async () => {
    if (!catName.trim()) return;
    try {
      if (editingCatId) await updateCategory(editingCatId, catName.trim(), catColor);
      else              await addCategory(catName.trim(), catColor);
      setCatModalVisible(false);
    } catch (e) { console.error(e); }
  };

  const confirmDeleteCat = (cat: Category) => {
    const count = tasks.filter(t => t.categoryId === cat.id).length;
    Alert.alert(
      'Delete category?',
      count > 0 ? `This will also delete ${count} task(s).` : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteCategory(cat.id);
          if (activeFilter === cat.id) setActiveFilter('all');
        }},
      ]
    );
  };

  // ── Task modal helpers ──
  const openNewTask = () => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskCatId(activeFilter !== 'all' ? activeFilter : (categories[0]?.id ?? ''));
    setTaskPoints('1');
    setTaskModalVisible(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskCatId(task.categoryId);
    setTaskPoints(String(task.points));
    setTaskModalVisible(true);
  };

  const saveTask = async () => {
    if (!taskTitle.trim() || !taskCatId) return;
    const pts = Math.max(1, parseInt(taskPoints) || 1);
    try {
      if (editingTaskId) await updateTask(editingTaskId, taskTitle.trim(), taskCatId, pts);
      else               await addTask(taskTitle.trim(), taskCatId, pts);
      setTaskModalVisible(false);
    } catch (e) { console.error(e); }
  };

  // ── Filtered task list ──
  const filteredTasks = activeFilter === 'all'
    ? tasks
    : tasks.filter(t => t.categoryId === activeFilter);
  const incomplete = filteredTasks.filter(t => !t.completed);
  const complete   = filteredTasks.filter(t => t.completed);
  const listData: (Task | 'divider')[] = [
    ...incomplete,
    ...(incomplete.length > 0 && complete.length > 0 ? ['divider' as const] : []),
    ...complete,
  ];

  const activeCat    = categories.find(c => c.id === activeFilter);
  const totalPts     = filteredTasks.reduce((s, t) => s + t.points, 0);
  const earnedPts    = filteredTasks.filter(t => t.completed).reduce((s, t) => s + t.points, 0);
  const sectionTitle = activeCat ? `◈ ${activeCat.name.toUpperCase()}` : '◈ ALL TASKS';

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Text style={styles.brandIcon}>▶</Text>
          <Text style={styles.brandTitle}>TASK TABBER</Text>
        </View>
        <View style={styles.headerActions}>
          <PixelButton label="+ CAT"  onPress={categories.length === 0 ? openNewCat : openNewCat} variant="primary" style={styles.headerBtn} />
          <PixelButton label="+ TASK" onPress={categories.length === 0 ? openNewCat : openNewTask} variant="primary" style={styles.headerBtn} />
          <PixelButton label="OUT" onPress={onSignOut} variant="small" />
        </View>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsBar}
        contentContainerStyle={styles.tabsContent}
      >
        {/* ALL tab */}
        <TouchableOpacity
          onPress={() => setActiveFilter('all')}
          style={[styles.catTab, activeFilter === 'all' && styles.catTabAllActive]}
        >
          <View style={styles.catTabHead}>
            <View style={[styles.catDot, { backgroundColor: '#fff' }]} />
            <Text style={[styles.catTabName, activeFilter === 'all' && styles.catTabNameActive]}>ALL</Text>
          </View>
          <Text style={[styles.catTabStats, activeFilter === 'all' && styles.catTabStatsActive]}>
            {tasks.length} tasks
          </Text>
        </TouchableOpacity>

        {categories.map(cat => (
          <CatTab
            key={cat.id}
            cat={cat}
            tasks={tasks.filter(t => t.categoryId === cat.id)}
            active={activeFilter === cat.id}
            onPress={() => setActiveFilter(cat.id)}
            onEdit={() => openEditCat(cat)}
            onDelete={() => confirmDeleteCat(cat)}
          />
        ))}
      </ScrollView>

      {/* Active category detail strip */}
      {activeCat && (() => {
        const catTasks  = tasks.filter(t => t.categoryId === activeCat.id);
        const done      = catTasks.filter(t => t.completed).length;
        const total     = catTasks.length;
        const pct       = total === 0 ? 0 : Math.round((done / total) * 100);
        const ptsE      = catTasks.filter(t => t.completed).reduce((s, t) => s + t.points, 0);
        const ptsT      = catTasks.reduce((s, t) => s + t.points, 0);
        const workDays  = new Set(catTasks.flatMap(t => t.datesWorked)).size;
        return (
          <View style={[styles.detailStrip, { borderBottomColor: activeCat.color }]}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DONE</Text>
              <Text style={styles.detailVal}>{done}/{total}</Text>
            </View>
            <View style={styles.detailBar}>
              <View style={[styles.detailFill, { width: `${pct}%` as any, backgroundColor: activeCat.color }]} />
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>PTS</Text>
              <Text style={styles.detailVal}>★ {ptsE}/{ptsT}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DAYS</Text>
              <Text style={styles.detailVal}>{workDays}</Text>
            </View>
          </View>
        );
      })()}

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {totalPts > 0 && <Text style={styles.totalPts}>★ {earnedPts} / {totalPts} PTS</Text>}
      </View>

      {/* Task list */}
      {listData.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>NO TASKS YET{'\n'}HIT + TASK TO ADD ONE</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, i) => (item === 'divider' ? 'div' : item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (item === 'divider') {
              return <View style={styles.divider}><Text style={styles.dividerText}>— COMPLETED —</Text></View>;
            }
            const cat = categories.find(c => c.id === item.categoryId);
            return (
              <TaskRow
                task={item}
                cat={cat}
                onToggle={() => toggleTask(item.id)}
                onEdit={() => openEditTask(item)}
                onLog={() => toggleWorkDay(item.id)}
                onDelete={() => Alert.alert('Delete task?', item.title, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteTask(item.id) },
                ])}
              />
            );
          }}
        />
      )}

      {/* Category modal */}
      <PixelModal
        visible={catModalVisible}
        title={editingCatId ? '■ EDIT CATEGORY' : '■ NEW CATEGORY'}
        onClose={() => setCatModalVisible(false)}
      >
        <PixelInput
          label="NAME"
          value={catName}
          onChangeText={setCatName}
          placeholder="Category name..."
          maxLength={20}
          autoFocus
          onSubmitEditing={saveCat}
        />
        <Text style={styles.fieldLabel}>COLOR</Text>
        <ColorPicker selected={catColor} onSelect={setCatColor} />
        <View style={styles.modalActions}>
          <PixelButton label="CANCEL" onPress={() => setCatModalVisible(false)} />
          <PixelButton label="SAVE" onPress={saveCat} variant="primary" />
        </View>
      </PixelModal>

      {/* Task modal */}
      <PixelModal
        visible={taskModalVisible}
        title={editingTaskId ? '■ EDIT TASK' : '■ NEW TASK'}
        onClose={() => setTaskModalVisible(false)}
      >
        <PixelInput
          label="TITLE"
          value={taskTitle}
          onChangeText={setTaskTitle}
          placeholder="Task title..."
          maxLength={50}
          autoFocus
          onSubmitEditing={saveTask}
        />
        <Text style={styles.fieldLabel}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catPicker}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setTaskCatId(cat.id)}
              style={[styles.catPickerItem, taskCatId === cat.id && { borderColor: cat.color }]}
            >
              <View style={[styles.catDot, { backgroundColor: cat.color }]} />
              <Text style={styles.catPickerText}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.ptsRow}>
          <Text style={styles.fieldLabel}>POINTS</Text>
          <View style={styles.ptsControls}>
            <PixelButton label="−" onPress={() => setTaskPoints(p => String(Math.max(1, (parseInt(p)||1)-1)))} variant="small" />
            <Text style={styles.ptsVal}>{taskPoints}</Text>
            <PixelButton label="+" onPress={() => setTaskPoints(p => String(Math.min(9999,(parseInt(p)||1)+1)))} variant="small" />
          </View>
        </View>
        <View style={styles.modalActions}>
          <PixelButton label="CANCEL" onPress={() => setTaskModalVisible(false)} />
          <PixelButton label="SAVE" onPress={saveTask} variant="primary" />
        </View>
      </PixelModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },

  // Header
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: C.surface, borderBottomWidth: 3, borderBottomColor: C.border },
  headerBrand:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon:     { fontFamily: 'PressStart2P_400Regular', fontSize: 12, color: C.accent },
  brandTitle:    { fontFamily: 'PressStart2P_400Regular', fontSize: 9, color: C.text, letterSpacing: 2 },
  headerActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  headerBtn:     {},

  // Tabs
  tabsBar:     { backgroundColor: C.surface, borderBottomWidth: 2, borderBottomColor: C.border, flexShrink: 0, maxHeight: 80 },
  tabsContent: { padding: 8, gap: 5 },
  catTab: {
    minWidth: 80, borderWidth: 2, borderColor: C.border, backgroundColor: C.panel2,
    padding: 7, shadowColor: C.shadow, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0,
  },
  catTabAllActive: { borderColor: C.accent },
  catTabHead:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  catDot:      { width: 7, height: 7, borderRadius: 0 },
  catTabName:  { fontFamily: 'PressStart2P_400Regular', fontSize: 6, color: C.textDim, maxWidth: 68 },
  catTabNameActive:  { color: C.text },
  catTabStats: { fontFamily: 'PressStart2P_400Regular', fontSize: 5, color: C.textFaint },
  catTabStatsActive: { color: C.textDim },
  catTabTrack: { height: 3, backgroundColor: C.border, overflow: 'hidden', marginTop: 4 },
  catTabFill:  { height: '100%' },

  // Detail strip
  detailStrip:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 6, backgroundColor: C.panel, borderBottomWidth: 2, borderBottomColor: C.border },
  detailItem:   { alignItems: 'center' },
  detailLabel:  { fontFamily: 'PressStart2P_400Regular', fontSize: 5, color: C.textDim, letterSpacing: 1 },
  detailVal:    { fontFamily: 'PressStart2P_400Regular', fontSize: 7, color: C.text },
  detailBar:    { flex: 1, height: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  detailFill:   { height: '100%' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, paddingBottom: 6 },
  sectionTitle:  { fontFamily: 'PressStart2P_400Regular', fontSize: 8, color: C.text, letterSpacing: 1 },
  totalPts:      { fontFamily: 'PressStart2P_400Regular', fontSize: 6, color: C.warn },

  // Task list
  listContent: { padding: 10, paddingTop: 0 },
  emptyState:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText:   { fontFamily: 'PressStart2P_400Regular', fontSize: 7, color: C.textFaint, textAlign: 'center', lineHeight: 18, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', padding: 20 },
  divider:     { alignItems: 'center', paddingVertical: 6, marginVertical: 4, borderTopWidth: 1, borderTopColor: C.border, borderBottomWidth: 1, borderBottomColor: C.border },
  dividerText: { fontFamily: 'PressStart2P_400Regular', fontSize: 5, color: C.textFaint, letterSpacing: 3 },

  // Task row
  taskItem:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.panel, borderWidth: 2, borderColor: C.border, borderLeftWidth: 4, padding: 7, marginBottom: 5 },
  taskDone:   { opacity: 0.5 },
  taskBody:   { flex: 1, minWidth: 0 },
  taskTitle:  { fontFamily: 'PressStart2P_400Regular', fontSize: 7, color: C.text, marginBottom: 4, lineHeight: 13 },
  taskTitleDone: { textDecorationLine: 'line-through', color: C.textDim },
  taskMeta:   { flexDirection: 'row', gap: 5, alignItems: 'center', flexWrap: 'wrap' },
  catBadge:   { paddingHorizontal: 5, paddingVertical: 1 },
  catBadgeText: { fontFamily: 'PressStart2P_400Regular', fontSize: 5, color: '#fff', letterSpacing: 1 },
  daysBadge:  { fontFamily: 'PressStart2P_400Regular', fontSize: 5, color: C.textDim },
  taskActions:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  ptsBadge:   { borderWidth: 1, borderColor: C.warn, paddingHorizontal: 5, paddingVertical: 2 },
  ptsBadgeText: { fontFamily: 'PressStart2P_400Regular', fontSize: 6, color: C.warn },
  logBtn:     { borderWidth: 2, borderColor: C.border, backgroundColor: C.panel2, paddingHorizontal: 6, paddingVertical: 3, minWidth: 36, alignItems: 'center' },
  logBtnLogged: { borderColor: C.success, backgroundColor: 'rgba(64,192,87,0.12)' },
  logBtnText: { fontFamily: 'PressStart2P_400Regular', fontSize: 6, color: C.textDim },
  logBtnTextLogged: { color: C.success },
  delBtn:     { borderWidth: 2, borderColor: C.border, backgroundColor: C.panel2, padding: 4 },
  delBtnText: { fontFamily: 'PressStart2P_400Regular', fontSize: 8, color: C.textDim },

  // Modals
  fieldLabel: { fontFamily: 'PressStart2P_400Regular', fontSize: 7, color: C.textDim, letterSpacing: 2, marginBottom: 6 },
  colorGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 14 },
  swatch:     { width: 20, height: 20, borderWidth: 2, borderColor: 'transparent' },
  swatchSel:  { borderColor: '#fff' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTopWidth: 2, borderTopColor: C.border },
  catPicker:  { marginBottom: 14 },
  catPickerItem: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 2, borderColor: C.border, padding: 6, marginRight: 6 },
  catPickerText: { fontFamily: 'PressStart2P_400Regular', fontSize: 6, color: C.text },
  ptsRow:     { marginBottom: 14 },
  ptsControls:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  ptsVal:     { fontFamily: 'PressStart2P_400Regular', fontSize: 12, color: C.text, minWidth: 40, textAlign: 'center' },
});
