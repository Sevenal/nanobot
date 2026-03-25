"""简化的 Docker 沙箱测试"""

import docker
import os
import sys
from pathlib import Path

# 设置 UTF-8 输出
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())


def test_docker_basic():
    """测试 Docker 基础功能"""
    print("=" * 60)
    print("Docker 沙箱基础测试")
    print("=" * 60)

    try:
        # 1. 连接 Docker
        print("\n1. 连接 Docker...")
        client = docker.from_env()
        print(f"   Docker 版本: {client.version()['Version']}")
        print("   ✅ Docker 连接成功")

        # 2. 拉取镜像
        print("\n2. 检查/拉取镜像...")
        image_name = "python:3.11-slim"
        try:
            client.images.get(image_name)
            print(f"   ✅ 镜像已存在: {image_name}")
        except:
            print(f"   正在拉取镜像: {image_name}...")
            image = client.images.pull(image_name)
            print(f"   ✅ 镜像拉取成功")

        # 3. 创建容器
        print("\n3. 创建容器...")
        container = client.containers.create(
            image_name,
            command="tail -f /dev/null",  # 保持容器运行
            detach=True,
            name="nanobot-test-sandbox"
        )
        print(f"   ✅ 容器创建成功: {container.id[:12]}")

        # 4. 启动容器
        print("\n4. 启动容器...")
        container.start()
        print("   ✅ 容器已启动")

        # 5. 执行命令
        print("\n5. 测试命令执行...")

        # 测试 Python 版本
        print("\n   测试: python --version")
        exit_code, output = container.exec_run("python --version")
        print(f"   输出: {output.decode('utf-8').strip()}")
        assert exit_code == 0
        print("   ✅ Python 可用")

        # 测试目录
        print("\n   测试: 创建工作目录")
        exit_code, output = container.exec_run("mkdir -p /workspace")
        assert exit_code == 0
        print("   ✅ 工作目录创建成功")

        # 测试文件操作
        print("\n   测试: 文件读写")
        container.exec_run("bash -c 'echo \"Hello from sandbox\" > /workspace/test.txt'")
        exit_code, output = container.exec_run("cat /workspace/test.txt")
        content = output.decode('utf-8').strip()
        print(f"   文件内容: {content}")
        assert content == "Hello from sandbox"
        print("   ✅ 文件操作正常")

        # 测试 Python 代码
        print("\n   测试: Python 代码执行")
        code = '''
import sys
print(f"Python: {sys.version}")
print("Hello from Python!")
'''
        exit_code, output = container.exec_run(f'python -c "{code}"')
        result = output.decode('utf-8')
        print(f"   输出:\n{result}")
        print("   ✅ Python 代码执行成功")

        # 6. 清理
        print("\n6. 清理容器...")
        container.stop()
        container.remove()
        print("   ✅ 容器已清理")

        print("\n" + "=" * 60)
        print("所有测试通过！Docker 沙箱功能正常")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_with_volume():
    """测试带卷挂载的容器"""
    print("\n" + "=" * 60)
    print("Docker 卷挂载测试")
    print("=" * 60)

    try:
        client = docker.from_env()

        # 创建测试目录
        test_dir = Path("C:/Users/DELL/.nanobot/sandbox-test")
        test_dir.mkdir(parents=True, exist_ok=True)

        # 创建测试文件
        test_file = test_dir / "host_file.txt"
        test_file.write_text("Hello from host!")

        print(f"\n1. 测试目录: {test_dir}")
        print(f"2. 测试文件: {test_file}")

        # 创建带卷挂载的容器
        print("\n3. 创建带卷挂载的容器...")
        container = client.containers.create(
            "python:3.11-slim",
            command="tail -f /dev/null",
            detach=True,
            name="nanobot-test-volume",
            volumes={
                str(test_dir): {
                    'bind': '/workspace',
                    'mode': 'rw'
                }
            }
        )

        container.start()
        print("   ✅ 容器已启动")

        # 在容器中读取文件
        print("\n4. 在容器中读取文件...")
        exit_code, output = container.exec_run("cat /workspace/host_file.txt")
        content = output.decode('utf-8').strip()
        print(f"   文件内容: {content}")
        assert content == "Hello from host!"
        print("   ✅ 卷挂载成功")

        # 在容器中写入文件
        print("\n5. 在容器中写入文件...")
        container.exec_run("bash -c 'echo \"Hello from container\" > /workspace/container_file.txt'")
        container_file = test_dir / "container_file.txt"
        content = container_file.read_text().strip()
        print(f"   文件内容: {content}")
        assert content == "Hello from container"
        print("   ✅ 容器写入成功")

        # 清理
        print("\n6. 清理...")
        container.stop()
        container.remove()
        print("   ✅ 容器已清理")

        print("\n" + "=" * 60)
        print("卷挂载测试通过！")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("\n开始 Docker 沙箱测试\n")

    # 测试 1: 基础功能
    basic_ok = test_docker_basic()

    # 测试 2: 卷挂载
    volume_ok = test_with_volume()

    # 总结
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    print(f"基础功能: {'✅ 通过' if basic_ok else '❌ 失败'}")
    print(f"卷挂载: {'✅ 通过' if volume_ok else '❌ 失败'}")
    print("=" * 60)

    if basic_ok and volume_ok:
        print("\n所有测试通过！Docker 沙箱已就绪！\n")
        return 0
    else:
        print("\n部分测试失败\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
