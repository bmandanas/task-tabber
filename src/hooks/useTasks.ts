import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type Category = { id: string; name: string; color: string };
export type Task = {
  id: string; categoryId: string; title: string; points: number;
  completed: boolean; completedAt: string | null; datesWorked: string[];
};

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function useTasks(userId: string | null) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loading, setLoading]       = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: cats }, { data: tsks }] = await Promise.all([
      supabase.from('categories').select('*').order('created_at'),
      supabase.from('tasks').select('*').order('created_at'),
    ]);
    setCategories((cats ?? []).map(r => ({ id: r.id, name: r.name, color: r.color })));
    setTasks((tsks ?? []).map(r => ({
      id: r.id, categoryId: r.category_id, title: r.title, points: r.points,
      completed: r.completed, completedAt: r.completed_at, datesWorked: r.dates_worked ?? [],
    })));
    setLoading(false);
  }, [userId]);

  const addCategory = async (name: string, color: string) => {
    const { data, error } = await supabase.from('categories').insert({ name, color }).select('id').single();
    if (error) throw error;
    setCategories(prev => [...prev, { id: data.id, name, color }]);
  };

  const updateCategory = async (id: string, name: string, color: string) => {
    const { error } = await supabase.from('categories').update({ name, color }).eq('id', id);
    if (error) throw error;
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name, color } : c));
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    setCategories(prev => prev.filter(c => c.id !== id));
    setTasks(prev => prev.filter(t => t.categoryId !== id));
  };

  const addTask = async (title: string, categoryId: string, points: number) => {
    const { data, error } = await supabase.from('tasks')
      .insert({ title, category_id: categoryId, points, completed: false, completed_at: null, dates_worked: [] })
      .select('id').single();
    if (error) throw error;
    setTasks(prev => [...prev, { id: data.id, title, categoryId, points, completed: false, completedAt: null, datesWorked: [] }]);
  };

  const updateTask = async (id: string, title: string, categoryId: string, points: number) => {
    const { error } = await supabase.from('tasks').update({ title, category_id: categoryId, points }).eq('id', id);
    if (error) throw error;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title, categoryId, points } : t));
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)!;
    const completed   = !task.completed;
    const completedAt = completed ? new Date().toISOString() : null;
    const datesWorked = [...task.datesWorked];
    if (completed) {
      const d = todayStr();
      if (!datesWorked.includes(d)) datesWorked.push(d);
    }
    const { error } = await supabase.from('tasks')
      .update({ completed, completed_at: completedAt, dates_worked: datesWorked }).eq('id', id);
    if (error) throw error;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed, completedAt, datesWorked } : t));
  };

  const toggleWorkDay = async (id: string) => {
    const task = tasks.find(t => t.id === id)!;
    const d = todayStr();
    const datesWorked = task.datesWorked.includes(d)
      ? task.datesWorked.filter(x => x !== d)
      : [...task.datesWorked, d];
    const { error } = await supabase.from('tasks').update({ dates_worked: datesWorked }).eq('id', id);
    if (error) throw error;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, datesWorked } : t));
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return { categories, tasks, loading, load,
           addCategory, updateCategory, deleteCategory,
           addTask, updateTask, toggleTask, toggleWorkDay, deleteTask };
}
