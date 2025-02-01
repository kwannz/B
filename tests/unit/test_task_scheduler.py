"""
任务调度器测试
"""

import os
import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from tradingbot.shared.task_scheduler import TaskScheduler


@pytest.fixture
async def scheduler():
    """创建调度器实例"""
    scheduler = TaskScheduler()
    await scheduler.initialize()
    yield scheduler
    await scheduler.close()


@pytest.mark.asyncio
async def test_scheduler_initialization(scheduler):
    """测试调度器初始化"""
    assert scheduler.initialized is True
    assert scheduler.scheduler.running is True
    assert isinstance(scheduler.tasks, dict)


@pytest.mark.asyncio
async def test_interval_task():
    """测试间隔任务"""
    counter = 0

    async def test_task():
        nonlocal counter
        counter += 1

    scheduler = TaskScheduler()
    await scheduler.initialize()

    # 添加每秒执行一次的任务
    await scheduler.add_interval_task("test_task", test_task, seconds=1)

    # 等待任务执行几次
    await asyncio.sleep(3)

    # 验证任务执行次数
    assert counter >= 2

    # 清理
    await scheduler.close()


@pytest.mark.asyncio
async def test_cron_task():
    """测试定时任务"""
    executed = False

    async def test_task():
        nonlocal executed
        executed = True

    scheduler = TaskScheduler()
    await scheduler.initialize()

    # 添加一分钟后执行的定时任务
    next_minute = (datetime.now() + timedelta(minutes=1)).strftime("%M %H %d %m *")
    await scheduler.add_cron_task("test_task", test_task, cron_expression=next_minute)

    # 验证任务已添加但未执行
    assert "test_task" in scheduler.tasks
    assert not executed

    # 清理
    await scheduler.close()


@pytest.mark.asyncio
async def test_task_timeout():
    """测试任务超时"""

    async def slow_task():
        await asyncio.sleep(2)

    scheduler = TaskScheduler()
    await scheduler.initialize()

    # 添加一个会超时的任务
    await scheduler.add_interval_task("slow_task", slow_task, seconds=1, timeout=1)

    # 等待任务执行
    await asyncio.sleep(3)

    # 验证任务状态
    task_info = scheduler.get_task_info("slow_task")
    assert task_info is not None

    # 清理
    await scheduler.close()


@pytest.mark.asyncio
async def test_task_error_handling():
    """测试任务错误处理"""
    error_count = 0

    async def failing_task():
        nonlocal error_count
        error_count += 1
        raise Exception("测试错误")

    scheduler = TaskScheduler()
    await scheduler.initialize()

    # 添加一个会失败的任务
    await scheduler.add_interval_task("failing_task", failing_task, seconds=1)

    # 等待任务执行几次
    await asyncio.sleep(3)

    # 验证错误计数
    assert error_count >= 2

    # 清理
    await scheduler.close()


@pytest.mark.asyncio
async def test_task_management():
    """测试任务管理功能"""
    counter = 0

    async def test_task():
        nonlocal counter
        counter += 1

    scheduler = TaskScheduler()
    await scheduler.initialize()

    # 添加任务
    await scheduler.add_interval_task("test_task", test_task, seconds=1)

    # 验证任务已添加
    assert "test_task" in scheduler.tasks

    # 暂停任务
    await scheduler.pause_task("test_task")
    initial_count = counter
    await asyncio.sleep(2)
    assert counter == initial_count

    # 恢复任务
    await scheduler.resume_task("test_task")
    await asyncio.sleep(2)
    assert counter > initial_count

    # 移除任务
    await scheduler.remove_task("test_task")
    assert "test_task" not in scheduler.tasks

    # 清理
    await scheduler.close()


@pytest.mark.asyncio
async def test_concurrent_tasks():
    """测试并发任务执行"""
    counters = {"task1": 0, "task2": 0}

    async def test_task(task_id):
        counters[task_id] += 1
        await asyncio.sleep(0.1)

    scheduler = TaskScheduler()
    await scheduler.initialize()

    # 添加两个并发任务
    await scheduler.add_interval_task("task1", lambda: test_task("task1"), seconds=1)
    await scheduler.add_interval_task("task2", lambda: test_task("task2"), seconds=1)

    # 等待任务执行
    await asyncio.sleep(3)

    # 验证两个任务都在执行
    assert counters["task1"] >= 2
    assert counters["task2"] >= 2

    # 清理
    await scheduler.close()


if __name__ == "__main__":
    pytest.main(["-v", __file__])
