import { priorities } from "../domain/workspace";
import { taskSortLabels, type PriorityFilter, type TaskSort } from "../domain/taskFilters";

interface TaskToolbarProps {
  priority: PriorityFilter;
  sort: TaskSort;
  shown: number;
  total: number;
  onPriorityChange: (priority: PriorityFilter) => void;
  onSortChange: (sort: TaskSort) => void;
}

export function TaskToolbar({ priority, sort, shown, total, onPriorityChange, onSortChange }: TaskToolbarProps) {
  return (
    <div className="task-toolbar" role="group" aria-label="Filter and sort tasks">
      <label>
        <span>Priority</span>
        <select value={priority} onChange={(event) => onPriorityChange(event.target.value as PriorityFilter)}>
          <option value="all">All</option>
          {priorities.map((level) => <option key={level} value={level}>{level}</option>)}
        </select>
      </label>
      <label>
        <span>Sort</span>
        <select value={sort} onChange={(event) => onSortChange(event.target.value as TaskSort)}>
          {(Object.keys(taskSortLabels) as TaskSort[]).map((option) => (
            <option key={option} value={option}>{taskSortLabels[option]}</option>
          ))}
        </select>
      </label>
      <span className="task-toolbar-summary" role="status">
        {priority === "all" ? `${total} tasks` : `${shown} of ${total} tasks`}
      </span>
    </div>
  );
}
