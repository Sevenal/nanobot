"""进化历史 CLI 命令"""

import json
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.markdown import Markdown

from nanobot.config.paths import get_workspace_path

app = typer.Typer(name="evolution", help="查看和管理 skill 进化历史")
console = Console()


@app.command("history")
def evolution_history(
    skill: Optional[str] = typer.Option(None, "--skill", "-s", help="Skill 名称"),
    limit: int = typer.Option(10, "--limit", "-n", help="显示最近 N 条记录"),
    status: Optional[str] = typer.Option(None, "--status", help="过滤状态 (success/failed/rollback)"),
    json_output: bool = typer.Option(False, "--json", "-j", help="JSON 格式输出"),
):
    """查看进化历史"""
    workspace = get_workspace_path()

    if not (workspace / ".nanobot" / "evolution" / "history.jsonl").exists():
        console.print("[yellow]没有找到进化历史记录[/yellow]")
        console.print("进化历史会在首次 skill 进化后自动创建")
        return

    # 加载历史
    from nanobot.agent.evolution.history import EvolutionHistoryManager

    history_manager = EvolutionHistoryManager(workspace)
    records = history_manager.get_history(
        skill_name=skill,
        limit=limit,
        status_filter=status
    )

    if not records:
        console.print("[yellow]没有找到匹配的进化记录[/yellow]")
        return

    if json_output:
        console.print(json.dumps(records, indent=2, ensure_ascii=False))
        return

    # 表格显示
    table = Table(title=f"进化历史 ({'All Skills' if not skill else skill})")
    table.add_column("时间", style="cyan")
    table.add_column("Skill", style="green")
    table.add_column("原因", style="yellow")
    table.add_column("状态", style="bold")
    table.add_column("更改", style="blue")

    status_emoji = {
        'success': '✅',
        'failed': '❌',
        'rollback': '⏪'
    }

    for record in records:
        status = record.get('status', 'unknown')
        emoji = status_emoji.get(status, '❓')
        changes = record.get('changes', [])
        changes_str = f"{len(changes)} 项" if changes else "无"

        table.add_row(
            record['timestamp'][:19].replace('T', ' '),
            record['skill_name'],
            record.get('reason', 'N/A')[:30],
            f"{emoji} {status}",
            changes_str
        )

    console.print(table)


@app.command("summary")
def evolution_summary(
    skill: Optional[str] = typer.Option(None, "--skill", "-s", help="Skill 名称"),
):
    """查看进化摘要统计"""
    workspace = get_workspace_path()

    if not (workspace / ".nanobot" / "evolution" / "summary.json").exists():
        console.print("[yellow]没有找到进化记录[/yellow]")
        return

    from nanobot.agent.evolution.history import EvolutionHistoryManager

    history_manager = EvolutionHistoryManager(workspace)

    if skill:
        # 单个 skill 的摘要
        summary = history_manager.get_skill_summary(skill)

        console.print(Panel(f"[bold cyan]{skill}[/bold cyan]"))
        console.print(f"总进化次数: [bold]{summary['total_evolutions']}[/bold]")
        console.print(f"成功: [green]{summary['successful']}[/green]")
        console.print(f"失败: [red]{summary['failed']}[/red]")
        console.print(f"回滚: [yellow]{summary['rolled_back']}[/yellow]")
        console.print(f"成功率: [bold]{summary['success_rate']}[/bold]")

        if summary['common_reasons']:
            console.print("\n常见进化原因:")
            for reason, count in summary['common_reasons']:
                console.print(f"  • {reason}: {count} 次")
    else:
        # 所有 skills 的摘要
        summaries = history_manager.get_all_summaries()

        table = Table(title="所有 Skills 进化摘要")
        table.add_column("Skill", style="cyan")
        table.add_column("总次数", justify="right")
        table.add_column("成功", justify="right")
        table.add_column("失败", justify="right")
        table.add_column("成功率", style="bold")

        for skill_name, summary in sorted(summaries.items()):
            table.add_row(
                skill_name,
                str(summary['total_evolutions']),
                f"[green]{summary['successful']}[/green]",
                f"[red]{summary['failed']}[/red]",
                summary['success_rate']
            )

        console.print(table)


@app.command("export")
def export_evolution_history(
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="输出文件路径"),
    view: bool = typer.Option(False, "--view", "-v", help="导出后查看内容"),
):
    """导出进化历史为 Markdown"""
    workspace = get_workspace_path()

    if not (workspace / ".nanobot" / "evolution" / "history.jsonl").exists():
        console.print("[yellow]没有找到进化记录[/yellow]")
        return

    from nanobot.agent.evolution.history import EvolutionHistoryManager

    history_manager = EvolutionHistoryManager(workspace)

    # 默认输出路径
    if output is None:
        output = workspace / "evolution_history.md"

    markdown_content = history_manager.export_to_markdown(output)

    console.print(f"[green]✓[/green] 已导出进化历史到: [cyan]{output}[/cyan]")

    if view:
        console.print("\n")
        md = Markdown(markdown_content)
        console.print(md)


@app.command("clean")
def clean_evolution_history(
    days: int = typer.Option(30, "--days", "-d", help="保留最近多少天的记录"),
    keep_successful: bool = typer.Option(True, "--keep-successful/--delete-all", help="是否保留成功的记录"),
    yes: bool = typer.Option(False, "--yes", "-y", help="确认删除"),
):
    """清理旧的进化记录"""
    workspace = get_workspace_path()

    if not (workspace / ".nanobot" / "evolution" / "history.jsonl").exists():
        console.print("[yellow]没有找到进化记录[/yellow]")
        return

    if not yes:
        confirm = typer.confirm(f"确定要删除 {days} 天前的记录吗？（保留成功记录: {keep_successful}）")
        if not confirm:
            console.print("已取消")
            return

    from nanobot.agent.evolution.history import EvolutionHistoryManager

    history_manager = EvolutionHistoryManager(workspace)
    deleted = history_manager.clear_old_records(days, keep_successful)

    console.print(f"[green]✓[/green] 已删除 [bold]{deleted}[/bold] 条旧记录")


@app.command("stats")
def evolution_stats():
    """显示进化统计信息"""
    workspace = get_workspace_path()

    if not (workspace / ".nanobot" / "evolution" / "summary.json").exists():
        console.print("[yellow]没有找到进化记录[/yellow]")
        return

    from nanobot.agent.evolution.history import EvolutionHistoryManager

    history_manager = EvolutionHistoryManager(workspace)

    # 读取摘要
    summary = history_manager._summary

    console.print(Panel("[bold]进化统计概览[/bold]"))
    console.print(f"总进化次数: [bold]{summary.get('total_evolutions', 0)}[/bold]")
    console.print(f"涉及 Skills: [bold cyan]{len(summary.get('skills', []))}[/bold cyan]")
    console.print(f"最后更新: [yellow]{summary.get('last_updated', 'N/A')}[/yellow]")

    if summary.get('evolutions_per_skill'):
        console.print("\n各 Skill 进化次数:")
        for skill, count in sorted(
            summary['evolutions_per_skill'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]:
            console.print(f"  [cyan]{skill}[/cyan]: {count} 次")
