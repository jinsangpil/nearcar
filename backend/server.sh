#!/bin/bash
# NearCar 백엔드 서버 관리 스크립트
# 사용법: ./server.sh {start|stop|restart|status}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8000
PID_FILE="$SCRIPT_DIR/server.pid"
LOG_FILE="$SCRIPT_DIR/server.log"
VENV_DIR="$SCRIPT_DIR/venv"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 가상환경 확인
check_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        echo -e "${RED}❌ 가상환경이 없습니다. 먼저 가상환경을 생성하세요.${NC}"
        echo "   python3 -m venv venv"
        exit 1
    fi
    
    if [ ! -f "$VENV_DIR/bin/activate" ]; then
        echo -e "${RED}❌ 가상환경 활성화 파일을 찾을 수 없습니다.${NC}"
        exit 1
    fi
}

# 포트 사용 중인 프로세스 찾기 (첫 번째 PID만 반환)
find_port_process() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        lsof -ti:$PORT 2>/dev/null | head -1
    else
        # Linux
        lsof -ti:$PORT 2>/dev/null | head -1 || fuser $PORT/tcp 2>/dev/null | awk '{print $1}' | head -1
    fi
}

# 포트 사용 중인 모든 프로세스 찾기
find_all_port_processes() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        lsof -ti:$PORT 2>/dev/null
    else
        # Linux
        lsof -ti:$PORT 2>/dev/null || fuser $PORT/tcp 2>/dev/null | awk '{print $1}'
    fi
}

# PID 파일에서 프로세스 찾기
get_pid_from_file() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE" 2>/dev/null
    fi
}

# 프로세스가 실행 중인지 확인
is_process_running() {
    local pid=$1
    if [ -z "$pid" ]; then
        return 1
    fi
    
    if ps -p "$pid" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# 서버 시작
start_server() {
    check_venv
    
    # 포트가 사용 중인지 확인하고 모든 프로세스 종료
    port_pids=$(find_all_port_processes)
    if [ -n "$port_pids" ]; then
        echo -e "${YELLOW}⚠️  포트 $PORT가 이미 사용 중입니다.${NC}"
        echo -e "${YELLOW}   기존 프로세스를 종료하고 새로 시작합니다...${NC}"
        for pid in $port_pids; do
            if [ -n "$pid" ]; then
                echo -e "${YELLOW}   프로세스 종료 중... (PID: $pid)${NC}"
                kill -9 "$pid" 2>/dev/null
            fi
        done
        sleep 2
    fi
    
    # PID 파일에서 프로세스 확인
    pid=$(get_pid_from_file)
    if [ -n "$pid" ] && is_process_running "$pid"; then
        echo -e "${YELLOW}⚠️  서버가 이미 실행 중입니다. (PID: $pid)${NC}"
        echo -e "${YELLOW}   재시작하려면 './server.sh restart'를 사용하세요.${NC}"
        return 1
    fi
    
    echo -e "${GREEN}🚀 서버를 시작합니다...${NC}"
    
    # 가상환경 활성화 후 서버 시작
    source "$VENV_DIR/bin/activate"
    nohup python -m uvicorn app.main:app --reload --host 0.0.0.0 --port $PORT > "$LOG_FILE" 2>&1 &
    server_pid=$!
    
    # PID 저장
    echo $server_pid > "$PID_FILE"
    
    # 프로세스가 정상적으로 시작되었는지 확인
    sleep 2
    if is_process_running "$server_pid"; then
        echo -e "${GREEN}✅ 서버가 시작되었습니다! (PID: $server_pid)${NC}"
        echo -e "${GREEN}   포트: $PORT${NC}"
        echo -e "${GREEN}   로그: $LOG_FILE${NC}"
        echo -e "${GREEN}   API 문서: http://localhost:$PORT/docs${NC}"
        return 0
    else
        echo -e "${RED}❌ 서버 시작에 실패했습니다.${NC}"
        echo -e "${RED}   로그를 확인하세요: $LOG_FILE${NC}"
        rm -f "$PID_FILE"
        return 1
    fi
}

# 서버 정지
stop_server() {
    local pid=$(get_pid_from_file)
    
    if [ -z "$pid" ]; then
        # PID 파일이 없으면 포트로 찾기
        pid=$(find_port_process)
        if [ -z "$pid" ]; then
            echo -e "${YELLOW}⚠️  실행 중인 서버를 찾을 수 없습니다.${NC}"
            return 1
        fi
    fi
    
    if ! is_process_running "$pid"; then
        echo -e "${YELLOW}⚠️  서버가 실행 중이 아닙니다. (PID: $pid)${NC}"
        rm -f "$PID_FILE"
        return 1
    fi
    
    echo -e "${YELLOW}🛑 서버를 정지합니다... (PID: $pid)${NC}"
    
    # SIGTERM으로 정상 종료 시도
    kill "$pid" 2>/dev/null
    
    # 5초 대기 후 강제 종료
    for i in {1..5}; do
        sleep 1
        if ! is_process_running "$pid"; then
            break
        fi
    done
    
    # 여전히 실행 중이면 강제 종료
    if is_process_running "$pid"; then
        echo -e "${YELLOW}   강제 종료 중...${NC}"
        kill -9 "$pid" 2>/dev/null
        sleep 1
    fi
    
    # 포트를 사용하는 다른 프로세스도 확인하고 모두 종료
    port_pids=$(find_all_port_processes)
    if [ -n "$port_pids" ]; then
        echo -e "${YELLOW}   포트 $PORT를 사용하는 프로세스 종료 중...${NC}"
        for port_pid in $port_pids; do
            if [ -n "$port_pid" ]; then
                echo -e "${YELLOW}     프로세스 종료 중... (PID: $port_pid)${NC}"
                kill -9 "$port_pid" 2>/dev/null
            fi
        done
    fi
    
    rm -f "$PID_FILE"
    
    if ! is_process_running "$pid"; then
        echo -e "${GREEN}✅ 서버가 정지되었습니다.${NC}"
        return 0
    else
        echo -e "${RED}❌ 서버 정지에 실패했습니다.${NC}"
        return 1
    fi
}

# 서버 재시작
restart_server() {
    echo -e "${YELLOW}🔄 서버를 재시작합니다...${NC}"
    stop_server
    sleep 2
    start_server
}

# 서버 상태 확인
check_status() {
    local pid=$(get_pid_from_file)
    local port_pid=$(find_port_process)
    
    echo -e "${GREEN}📊 서버 상태${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # PID 파일 확인
    if [ -f "$PID_FILE" ]; then
        echo -e "PID 파일: ${GREEN}존재${NC} (PID: $pid)"
        if [ -n "$pid" ] && is_process_running "$pid"; then
            echo -e "프로세스 상태: ${GREEN}실행 중${NC}"
            
            # 프로세스 정보
            if command -v ps > /dev/null; then
                ps_info=$(ps -p "$pid" -o pid,etime,command --no-headers 2>/dev/null)
                if [ -n "$ps_info" ]; then
                    echo "프로세스 정보: $ps_info"
                fi
            fi
        else
            echo -e "프로세스 상태: ${RED}실행 중 아님${NC}"
        fi
    else
        echo -e "PID 파일: ${YELLOW}없음${NC}"
    fi
    
    # 포트 확인
    port_pids=$(find_all_port_processes)
    if [ -n "$port_pids" ]; then
        pid_list=$(echo $port_pids | tr '\n' ' ' | sed 's/ $//')
        echo -e "포트 $PORT: ${GREEN}사용 중${NC} (PID: $pid_list)"
        
        # HTTP 응답 확인
        if command -v curl > /dev/null; then
            http_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/health 2>/dev/null)
            if [ "$http_status" = "200" ]; then
                echo -e "HTTP 상태: ${GREEN}정상${NC} (200 OK)"
                health_response=$(curl -s http://localhost:$PORT/health 2>/dev/null)
                echo "Health Check: $health_response"
            else
                echo -e "HTTP 상태: ${YELLOW}응답 없음${NC} ($http_status)"
            fi
        fi
    else
        echo -e "포트 $PORT: ${RED}사용 안 함${NC}"
    fi
    
    # 로그 파일 확인
    if [ -f "$LOG_FILE" ]; then
        log_size=$(du -h "$LOG_FILE" | cut -f1)
        echo -e "로그 파일: ${GREEN}존재${NC} (크기: $log_size)"
        echo "최근 로그 (마지막 5줄):"
        tail -5 "$LOG_FILE" 2>/dev/null | sed 's/^/  /'
    else
        echo -e "로그 파일: ${YELLOW}없음${NC}"
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 종합 상태
    if [ -n "$port_pids" ]; then
        # 포트를 사용하는 프로세스 중 하나라도 PID 파일과 일치하는지 확인
        pid_match=false
        for port_pid in $port_pids; do
            if [ "$port_pid" = "$pid" ] && is_process_running "$pid"; then
                pid_match=true
                break
            fi
        done
        
        if [ "$pid_match" = true ]; then
            echo -e "${GREEN}✅ 서버가 정상적으로 실행 중입니다.${NC}"
            return 0
        elif [ -n "$pid" ] && is_process_running "$pid"; then
            echo -e "${YELLOW}⚠️  서버 프로세스는 실행 중이지만 포트가 다릅니다.${NC}"
            return 1
        else
            echo -e "${YELLOW}⚠️  포트는 사용 중이지만 PID 파일과 일치하지 않습니다.${NC}"
            return 1
        fi
    elif [ -n "$pid" ] && is_process_running "$pid"; then
        echo -e "${YELLOW}⚠️  서버 프로세스는 실행 중이지만 포트를 사용하지 않습니다.${NC}"
        return 1
    else
        echo -e "${RED}❌ 서버가 실행 중이 아닙니다.${NC}"
        return 1
    fi
}

# 사용법 출력
show_usage() {
    echo "사용법: $0 {start|stop|restart|status}"
    echo ""
    echo "명령어:"
    echo "  start   - 서버 시작 (포트가 사용 중이면 기존 프로세스 종료 후 시작)"
    echo "  stop    - 서버 정지"
    echo "  restart - 서버 재시작"
    echo "  status  - 서버 상태 확인"
    echo ""
    echo "예시:"
    echo "  $0 start    # 서버 시작"
    echo "  $0 status   # 상태 확인"
    echo "  $0 stop    # 서버 정지"
}

# 메인 로직
main() {
    case "${1:-}" in
        start)
            start_server
            ;;
        stop)
            stop_server
            ;;
        restart)
            restart_server
            ;;
        status)
            check_status
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# 스크립트 실행
main "$@"

