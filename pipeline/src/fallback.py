from __future__ import annotations

import json
from datetime import datetime, timezone

from src import paths
from src.models import Lesson

DISCLAIMER = "根据公开信息整理，非投资/内幕建议。"


def _topics() -> list[dict]:
    topics = json.loads(
        (paths.content_dir() / "fallback-topics.json").read_text(encoding="utf-8")
    )
    if not topics:
        raise RuntimeError("fallback-topics.json 不能为空")
    return topics


def _read_index() -> int:
    path = paths.content_dir() / "fallback-progress.json"
    if not path.exists():
        return 0
    progress = json.loads(path.read_text(encoding="utf-8"))
    index = progress.get("nextIndex")
    if isinstance(index, bool) or not isinstance(index, int) or index < 0:
        raise ValueError("fallback-progress.json 中的 nextIndex 必须是非负整数")
    return index


def pick_fallback_topic() -> dict:
    topics = _topics()
    return topics[_read_index() % len(topics)]


def advance_fallback() -> None:
    topics = _topics()
    next_index = (_read_index() + 1) % len(topics)
    path = paths.content_dir() / "fallback-progress.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"nextIndex": next_index}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def create_fallback_lesson(
    date: str, topic: dict, *, created_at: str | None = None
) -> Lesson:
    subject = topic["subject"]
    action = topic["action"]
    lesson: Lesson = {
        "date": date,
        "slot": "afternoon",
        "type": topic["type"],
        "title": topic["title"],
        "estimatedMinutes": 20,
        "intro": (
            f"今天的公开资讯源没有返回足够可靠的候选，或者写稿服务暂时不可用。为了不让学习节奏中断，我们改做一篇经典主题复盘，主题是「{subject}」。"
            "热点每天变化，但判断信息、拆解问题和验证结果的方法不会很快过时。你可以把今天看成一次能力补给：不追逐新名词，而是练习如何把 AI 放进真实任务中。"
            "读完后，你应该能解释这个主题解决什么问题、它不能保证什么，以及下一次动手时如何降低出错概率。本文不会假装报道刚发生的新闻，也不会用未经核实的事件填补空白。"
            "学习时不必一次记住全部细节，可以先抓住一个判断框架，再用小任务验证。遇到陌生词先问它在当前任务里起什么作用，遇到漂亮结论则追问证据在哪里。"
            "复盘时可以准备一张纸，把已知事实、暂时推测和下一步行动分成三栏。已知事实要能指出来源，暂时推测要注明不确定性，行动则要小到今天能够完成。"
            "如果答案里出现数字、日期、人物或机构名称，就把它们单独圈出来逐项核对；如果结论会影响别人，也要请相关的人一起确认。"
            "这种做法看起来比直接接受答案慢一点，却能减少返工，也能帮助你分辨工具真正节省了哪部分时间。"
            "把核验结果也留下简短记录，下次遇到相似问题时就能直接复用判断依据，而不是每次从头猜测。"
        ),
        "sections": [
            {
                "heading": "先把概念说成人话",
                "body": (
                    f"「{subject}」听起来可能像技术术语，但理解它不需要先学编程。更实用的办法是先问：输入是什么、系统做了什么、输出要由谁负责。"
                    "AI 擅长根据已有文字模式快速组织答案，像一位阅读量很大、反应很快的助手；它并不因此自动拥有事实核验能力，也不会替你承担决定的后果。"
                    "面对一个新功能，不要只问它聪不聪明，还要问它依据什么、哪些条件下容易失效、错误是否容易发现。把这三个问题写下来，通常比记住一串产品名更有用。"
                    f"对于{subject}，最关键的实践动作是：{action}。这条动作能把模糊期待变成可以检查的过程。"
                ),
            },
            {
                "heading": "为什么值得反复复盘",
                "body": (
                    "AI 产品更新很快，界面、模型名称和排行榜经常变化，但常见风险高度重复：问题描述不完整，模型就自行补齐；资料来源不清楚，流畅表达就容易被误当成事实。"
                    f"复盘{subject}，就是训练自己在兴奋和焦虑之外建立稳定判断。看到效率提高十倍时，先确认比较基线；看到完全自动化时，先找仍由人负责的环节。"
                    "这样做不是拒绝新工具，而是让尝试成本可控。你仍可大胆实验，只是把实验限定在可撤销、低风险范围，例如草稿、分类、头脑风暴和个人学习。"
                    "涉及医疗、法律、投资或重要承诺时，不应直接采用未经检查的结果。"
                ),
            },
            {
                "heading": "今天就能完成的小练习",
                "body": (
                    "选一个熟悉的普通任务，例如整理笔记、概括文章，或把杂乱想法变成清单。第一轮只给 AI 一句模糊要求并保存结果；第二轮补充目标读者、已有背景、必须保留的信息和不能编造的内容。"
                    "比较两轮答案，不要只凭感觉，而要列出三项指标：遗漏是否减少、事实是否能回到原文、结果是否可以直接进入下一步。随后故意加入一条不确定信息，观察模型会主动标注未知，还是顺势写成肯定句。"
                    f"最后执行今天的关键动作——{action}。练习控制在十五分钟内即可，价值不在完美答案，而在亲眼看到输入约束、验证步骤和结果质量之间的关系。"
                ),
            },
            {
                "heading": "建立可长期复用的检查清单",
                "body": (
                    "以后每次使用 AI，都可以套用四步清单。第一步说明任务：我要解决谁的什么问题，完成标准是什么。第二步提供材料：哪些是可信输入，哪些只是待验证线索。"
                    "第三步限制输出：要求区分事实、推测与建议，无法确认时明确说不知道。第四步人工验收：数字回查计算，引用打开原文，重要结论至少找一个独立来源。"
                    "若任务涉及隐私，还要在输入前删除姓名、联系方式、账号、合同细节等敏感信息。完成后记录一个具体改进点，而不是笼统评价 AI 好用或不好用。"
                    f"围绕{subject}坚持几次，你会逐渐形成自己的提示模板和验收标准。工具更换时，这套方法仍然有效。"
                ),
            },
        ],
        "quiz": [
            {
                "question": f"处理「{subject}」相关任务时，哪种做法更稳妥？",
                "options": ["只看答案是否流畅", action, "默认模型不会犯错", "省略目标和背景"],
                "answerIndex": 1,
                "explanation": "把任务约束和验证动作写清楚，才能让结果可检查、可复用。",
            },
            {
                "question": "AI 给出看似权威的重要结论时，应该怎么做？",
                "options": ["直接转发", "只让 AI 再说一遍", "回到原始资料并交叉核验", "根据语气判断真假"],
                "answerIndex": 2,
                "explanation": "流畅度不等于真实性，重要事实需要回到可访问的来源核对。",
            },
        ],
        "takeaway": f"工具会变化，可靠方法不会：围绕{subject}明确任务、约束输出，并亲自验证关键结果。",
        "disclaimer": DISCLAIMER,
        "status": "ok",
        "createdAt": created_at
        or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    return lesson
