// 授業数の変化に連動して総コマ数をリアルタイム更新
document.getElementById('courseCount').addEventListener('input', (e) => {
  const val = parseInt(e.target.value) || 0;
  document.getElementById('totalClassesCount').textContent = val * 15;
});

function saveSettings() {
  const settings = {
    courseCount: document.getElementById('courseCount').value,
    caps: [0, 1, 2, 3, 4, 5, 6].map(i => document.getElementById(`cap${i}`).value)
  };
  localStorage.setItem('studyPlannerSettings', JSON.stringify(settings));
}

function loadSettings() {
  const saved = localStorage.getItem('studyPlannerSettings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      if (settings.courseCount) {
        document.getElementById('courseCount').value = settings.courseCount;
        document.getElementById('totalClassesCount').textContent = settings.courseCount * 15;
      }
      if (settings.caps && settings.caps.length === 7) {
        settings.caps.forEach((cap, i) => {
          document.getElementById(`cap${i}`).value = cap;
        });
      }
      return true;
    } catch (e) { return false; }
  }
  return false;
}

function setDay(result) {
  result.forEach(row => {
    if (row.length >= 2) {
      const key = row[0].trim();
      // YYYY/MM/DD を YYYY-MM-DD 形式に変換（HTMLのdate入力欄用）
      const val = row[1].trim().replace(/\//g, '-'); 

      if (key === 'startDate') {
        document.getElementById('startDate').value = val;
      } else if (key === 'd1') {
        document.getElementById('dl1').value = val;
      } else if (key === 'd2') {
        document.getElementById('dl2').value = val;
      } else if (key === 'd3') {
        document.getElementById('dl3').value = val;
      }
    }
  });

  // 日付をセットした後にシミュレーターを再実行
  runSimulation();
}

function getCSV(){
    const req = new XMLHttpRequest();
    req.open("get", "assets/data.csv", true);
    req.send(null);
 
    req.onload = function(){
        const result = convertCSVtoArray(req.responseText);
        setDay(result);
    }
}

// 読み込んだCSVデータを二次元配列に変換して返す関数
function convertCSVtoArray(str){
    const tmp = str.split("\n");
    const result = [];

    for(let i = 0; i < tmp.length; ++i){
        if(tmp[i].trim() === "") continue;
        result[i] = tmp[i].split(',');
    }
    return result;
}

function setPreset(caps) {
  for (let i = 0; i < 7; i++) {
    document.getElementById(`cap${i}`).value = caps[i];
  }
}

function resetDefaults() {
  document.getElementById('courseCount').value = 4;
  document.getElementById('totalClassesCount').textContent = 60;
  setPreset([0, 2, 2, 2, 2, 2, 0]);
  saveSettings();
  getCSV();
}

document.addEventListener("DOMContentLoaded", () => {
  if (!loadSettings()) {
    resetDefaults();
  }
  getCSV();
});

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateStr(dateStr) {
  const parts = dateStr.split('-');
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

document.getElementById('simulatorForm').addEventListener('submit', function (e) {
  e.preventDefault();
  saveSettings();
  runSimulation();
});

// フォームの入力が変わったら自動保存
document.getElementById('simulatorForm').addEventListener('change', function (e) {
  saveSettings();
});

function runSimulation() {
  const courseCount = parseInt(document.getElementById('courseCount').value) || 0;

  const startDate = parseDateStr(document.getElementById('startDate').value);
  const dl1 = parseDateStr(document.getElementById('dl1').value);
  const dl2 = parseDateStr(document.getElementById('dl2').value);
  const dl3 = parseDateStr(document.getElementById('dl3').value);

  const capacities = [
    parseInt(document.getElementById('cap0').value) || 0,
    parseInt(document.getElementById('cap1').value) || 0,
    parseInt(document.getElementById('cap2').value) || 0,
    parseInt(document.getElementById('cap3').value) || 0,
    parseInt(document.getElementById('cap4').value) || 0,
    parseInt(document.getElementById('cap5').value) || 0,
    parseInt(document.getElementById('cap6').value) || 0
  ];

  const weeklyCapacity = capacities.reduce((a, b) => a + b, 0);

  const msgBox = document.getElementById('resultMessage');
  const container = document.getElementById('calendarContainer');
  const summaryCards = document.getElementById('summaryCards');

  container.innerHTML = '';
  msgBox.classList.add('hidden');

  if (weeklyCapacity === 0) {
    showMsg(msgBox, "⚠️ <b>エラー:</b> 1週間の進行コマ数が0です。曜日別のコマ数を設定してください。", 'error');
    return;
  }

  // 日付順序チェック
  if (!(startDate <= dl1 && dl1 < dl2 && dl2 < dl3)) {
    showMsg(msgBox, "⚠️ <b>エラー:</b> 日付の順序が正しくありません。（開始日 ≦ 締切1 ＜ 締切2 ＜ 締切3）", 'error');
    return;
  }

  const schedule = {};
  let errors = [];

  const courseNames = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // 授業タスク作成
  const generateTasks = (startRound, endRound) => {
    const tasks = [];
    for (let round = startRound; round <= endRound; round++) {
      for (let c = 0; c < courseCount; c++) {
        const cName = courseNames[c % 26] + (c >= 26 ? Math.floor(c / 26) : '');
        tasks.push({ name: cName, round: round, courseIdx: c % 8 });
      }
    }
    return tasks;
  };

  const missedDeadlines = { dl1: false, dl2: false, dl3: false };
  const delayedCounts = { dl1: 0, dl2: 0, dl3: 0 };

  // すべてのタスクを1つの配列にまとめ、それぞれの締切情報を付与
  const allTasks = [];
  generateTasks(1, 5).forEach(t => allTasks.push({ ...t, deadline: dl1, dlName: 'dl1' }));
  generateTasks(6, 10).forEach(t => allTasks.push({ ...t, deadline: dl2, dlName: 'dl2' }));
  generateTasks(11, 15).forEach(t => allTasks.push({ ...t, deadline: dl3, dlName: 'dl3' }));

  let currentPointer = new Date(startDate);
  let maxRenderDate = new Date(dl3);
  let taskIdx = 0;

  // タスクを1日ごとの上限まで隙間なく割り当て
  while (taskIdx < allTasks.length) {
    const dayOfWeek = currentPointer.getDay();
    const cap = capacities[dayOfWeek];

    if (cap > 0) {
      let assignedToday = 0;
      const dateStr = formatDateInput(currentPointer);

      while (assignedToday < cap && taskIdx < allTasks.length) {
        const task = allTasks[taskIdx];
        const isDelayed = currentPointer > task.deadline;

        if (!schedule[dateStr]) schedule[dateStr] = [];

        schedule[dateStr].push({
          name: task.name,
          round: task.round,
          courseIdx: task.courseIdx,
          delayed: isDelayed
        });

        if (isDelayed) {
          delayedCounts[task.dlName]++;
          missedDeadlines[task.dlName] = true;
        }

        assignedToday++;
        taskIdx++;
      }
    }

    // まだタスクが残っている場合は次の日へ進める
    if (taskIdx < allTasks.length) {
      currentPointer.setDate(currentPointer.getDate() + 1);
    }
  }

  if (delayedCounts.dl1 > 0) errors.push(`締切1を <b>${delayedCounts.dl1}コマ</b> 分オーバーしています。`);
  if (delayedCounts.dl2 > 0) errors.push(`締切2を <b>${delayedCounts.dl2}コマ</b> 分オーバーしています。`);
  if (delayedCounts.dl3 > 0) errors.push(`締切3を <b>${delayedCounts.dl3}コマ</b> 分オーバーしています。`);

  // カレンダーの描画終了日を遅延分まで延長する
  if (currentPointer > maxRenderDate) {
    maxRenderDate = new Date(currentPointer);
  }

  // サマリーカードの表示更新
  summaryCards.classList.remove('hidden');
  document.getElementById('statTotal').textContent = `${courseCount * 15} コマ`;
  document.getElementById('statWeekly').textContent = `${weeklyCapacity} コマ/週`;

  if (errors.length > 0) {
    document.getElementById('statStatusIcon').textContent = '⚠️';
    document.getElementById('statStatusIcon').className = 'p-3 bg-amber-50 text-amber-600 rounded-lg text-xl font-bold';
    document.getElementById('statStatusText').textContent = '調整が必要';

    showMsg(msgBox, "<b>⚠️ スケジュール調整が必要です</b><br><ul class='list-disc pl-5 mt-1 space-y-1'>" + errors.map(e => `<li>${e}</li>`).join("") + "</ul><span class='text-xs opacity-80 mt-2 block'>曜日の進行コマ数を増やすか、締め切り日を長めに設定してください。</span>", 'error');
  } else {
    document.getElementById('statStatusIcon').textContent = '✨';
    document.getElementById('statStatusIcon').className = 'p-3 bg-emerald-50 text-emerald-600 rounded-lg text-xl font-bold';
    document.getElementById('statStatusText').textContent = '計画完了';

    showMsg(msgBox, `✨ <b>素晴らしい計画です！</b> 全 ${courseCount * 15} コマの割り当てが完了しました。`, 'success');
  }

  // 授業凡例の描画
  renderLegend(courseCount, courseNames);

  // カレンダーの描画
  renderCalendars(container, schedule, startDate, dl1, dl2, dl3, maxRenderDate, missedDeadlines);
}

function showMsg(el, htmlMsg, type) {
  el.classList.remove('hidden', 'bg-amber-50', 'text-amber-800', 'border-amber-200', 'bg-emerald-50', 'text-emerald-800', 'border-emerald-200');
  if (type === 'error') {
    el.classList.add('bg-amber-50', 'text-amber-800', 'border-amber-200');
  } else {
    el.classList.add('bg-emerald-50', 'text-emerald-800', 'border-emerald-200');
  }
  el.innerHTML = htmlMsg;
}

function renderLegend(courseCount, courseNames) {
  const legendContainer = document.getElementById('legendContainer');
  const legendWrapper = document.getElementById('courseLegend');
  legendContainer.innerHTML = '';
  legendWrapper.classList.remove('hidden');

  for (let c = 0; c < courseCount; c++) {
    const cName = courseNames[c % 26] + (c >= 26 ? Math.floor(c / 26) : '');
    const colorClass = `course-color-${c % 8}`;

    const badge = document.createElement('span');
    badge.className = `px-2 py-1 rounded text-xs font-bold border-l-4 ${colorClass}`;
    badge.textContent = `授業 ${cName}`;
    legendContainer.appendChild(badge);
  }

  // 遅延アイコンも追加
  const delayedBadge = document.createElement('span');
  delayedBadge.className = `px-2 py-1 rounded text-xs font-bold border-l-4 bg-red-500 text-white border-red-700`;
  delayedBadge.innerHTML = `⚠️ 遅延（締切オーバー）`;
  legendContainer.appendChild(delayedBadge);
}

function renderCalendars(container, schedule, startDate, dl1, dl2, dl3, maxRenderDate, missedDeadlines) {
  const datesToRender = [];
  let cur = new Date(startDate);
  const todayStr = formatDateInput(new Date());

  while (cur <= maxRenderDate) {
    datesToRender.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  if (datesToRender.length === 0) return;

  const months = {};
  datesToRender.forEach(d => {
    const monthKey = `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
    if (!months[monthKey]) months[monthKey] = [];
    months[monthKey].push(d);
  });

  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  for (const [monthLabel, days] of Object.entries(months)) {
    const monthEl = document.createElement('div');
    monthEl.className = "bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200";

    let html = `<div class="bg-slate-800 text-white font-bold px-5 py-3 text-sm flex justify-between items-center">
                <span>🗓️ ${monthLabel}</span>
                <span class="text-xs text-slate-300 font-medium bg-slate-700 px-2 py-0.5 rounded-full">${days.length} 日間</span>
            </div>`;
    html += `<div class="calendar-grid">`;

    dayNames.forEach((name, idx) => {
      const colorClass = idx === 0 ? 'text-red-500' : (idx === 6 ? 'text-blue-500' : 'text-slate-600');
      html += `<div class="bg-slate-50 py-2 text-center text-xs font-bold ${colorClass}">${name}</div>`;
    });

    const firstDayOfWeek = days[0].getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      html += `<div class="calendar-cell bg-slate-50/50"></div>`;
    }

    days.forEach(d => {
      const dateStr = formatDateInput(d);
      const dayNum = d.getDate();
      const dayOfWeek = d.getDay();
      let textColor = "text-slate-700";
      let dayBgClass = "bg-white";

      if (dayOfWeek === 0) {
        textColor = "text-red-600";
        dayBgClass = "bg-red-50/30";
      } else if (dayOfWeek === 6) {
        textColor = "text-blue-600";
        dayBgClass = "bg-blue-50/30";
      }

      let badgesHtml = '';
      let cellExtraClass = dayBgClass;

      // 今日のハイライト判定
      if (dateStr === todayStr) {
        cellExtraClass = 'today-highlight relative z-10';
        badgesHtml += `<div class="event-badge bg-amber-100 text-amber-700 border-amber-300 mb-0.5"><span class="text-[10px]">📍 今日</span></div>`;
      }

      if (dateStr === formatDateInput(startDate)) {
        badgesHtml += `<div class="event-badge bg-start"><span>🚩</span><span>開始日</span></div>`;
      }
      if (dateStr === formatDateInput(dl1)) {
        const extra = missedDeadlines.dl1 ? 'animate-pulse ring-2 ring-red-500 ring-offset-1 bg-red-100' : '';
        badgesHtml += `<div class="event-badge bg-dl1 ${extra}"><span>⏰</span><span>締切 1</span></div>`;
        if (missedDeadlines.dl1) cellExtraClass = 'bg-red-50 border border-red-200 relative z-10';
      }
      if (dateStr === formatDateInput(dl2)) {
        const extra = missedDeadlines.dl2 ? 'animate-pulse ring-2 ring-red-500 ring-offset-1 bg-red-100' : '';
        badgesHtml += `<div class="event-badge bg-dl2 ${extra}"><span>⏰</span><span>締切 2</span></div>`;
        if (missedDeadlines.dl2) cellExtraClass = 'bg-red-50 border border-red-200 relative z-10';
      }
      if (dateStr === formatDateInput(dl3)) {
        const extra = missedDeadlines.dl3 ? 'animate-pulse ring-2 ring-red-500 ring-offset-1 bg-red-100' : '';
        badgesHtml += `<div class="event-badge bg-dl3 ${extra}"><span>⏰</span><span>締切 3</span></div>`;
        if (missedDeadlines.dl3) cellExtraClass = 'bg-red-50 border border-red-200 relative z-10';
      }

      if (schedule[dateStr]) {
        schedule[dateStr].forEach(item => {
          if (item.delayed) {
            badgesHtml += `
                                <div class="task-badge bg-red-500 text-white border-red-700 shadow-sm">
                                    <svg class="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span class="truncate">授業${item.name}-${item.round}回</span>
                                </div>`;
            cellExtraClass = 'bg-red-50/50';
          } else {
            const colorClass = `course-color-${item.courseIdx}`;
            badgesHtml += `
                                <div class="task-badge ${colorClass}">
                                    <span class="truncate">授業${item.name}-${item.round}回</span>
                                </div>`;
          }
        });
      }

      html += `
                    <div class="calendar-cell ${cellExtraClass}">
                        <span class="date-label ${textColor}">${dayNum}</span>
                        ${badgesHtml}
                    </div>
                `;
    });

    html += `</div>`;
    monthEl.innerHTML = html;
    container.appendChild(monthEl);
  }
}