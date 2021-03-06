<template>
  <el-menu mode="horizontal" class="menu" :default-active="active" router>
    <el-menu-item class="menu-logo">FileTunnel</el-menu-item>
    <el-menu-item index="/friend" class="menu-item"><i class="el-icon-user-solid"></i>好友</el-menu-item>
    <el-menu-item index="/message" class="menu-item">
      <i class="el-icon-s-order"></i>队列
      <el-badge :value="currentCount" :hidden="currentCount === 0"></el-badge>
    </el-menu-item>
    <el-menu-item index="/offlineTransfer" class="menu-item"><i class="el-icon-upload"></i>离线</el-menu-item>
    <el-menu-item index="/settings" class="menu-item"><i class="el-icon-s-tools"></i>设置</el-menu-item>

    <template v-if="sessionId === null">
      <el-tooltip effect="dark" content="" placement="bottom">
        <div slot="content">
          <template v-if="connectionStatus !== status.connection.CONNECTED">未连接服务器时无法登录</template>
          <template v-else>点击登录/注册</template>
        </div>
        <el-menu-item
          class="menu-item menu-item-right"
          @click="(e) => $emit('login-click', e)"
          :disabled="connectionStatus !== status.connection.CONNECTED"
        >登录/注册</el-menu-item>
      </el-tooltip>
    </template>
    <template v-else>
      <el-submenu class="menu-item menu-item-right" index="user">
        <template slot="title"><i class="el-icon-s-custom"></i>{{ username }}</template>
        <el-menu-item @click="logout"><i class="el-icon-error"></i>登出</el-menu-item>
      </el-submenu>
      <el-popover
        placement="bottom"
        width="200"
        trigger="click">
        <el-menu-item class="menu-item menu-item-right" style="padding: 0 5px" slot="reference">
          <i class="el-icon-chat-dot-square" style="margin: 0"></i>
          <el-badge :value="friendRequestLength" :hidden="friendRequestLength === 0"></el-badge>
        </el-menu-item>
        <FriendRequest @friend-changed="$emit('friend-changed')"/>
      </el-popover>
    </template>

    <el-tooltip effect="dark" placement="bottom">
      <div slot="content">
        <template v-if="connectionStatus === status.connection.CONNECTED">已连接服务器</template>
        <template v-else-if="connectionStatus === status.connection.CONNECTING">正在连接服务器</template>
        <template v-else>服务器连接已断开，点击重新连接</template>
      </div>
      <el-menu-item class="menu-item menu-item-right menu-item-status" @click="reconnectServer">
        连接状态&nbsp;
        <el-badge v-if="connectionStatus === status.connection.CONNECTED" type="success" is-dot/>
        <el-badge v-else-if="connectionStatus === status.connection.CONNECTING" type="warning" is-dot/>
        <el-badge v-else type="info" is-dot/>
      </el-menu-item>
    </el-tooltip>
  </el-menu>
</template>

<script>
  /**
   * Top menu component
   */
  import FriendRequest from './FriendRequestList'
  import { mapState } from 'vuex'
  import status from '../../client/status'
  import { ipcRenderer } from 'electron'
  export default {
    name: 'Menu',
    components: { FriendRequest },
    computed: {
      active () {
        if (this.$route.path.startsWith('/settings')) {
          return '/settings'
        }
        return this.$route.path
      },
      status: () => status,
      ...mapState({
        connectionStatus: state => state.system.connectionStatus,
        sessionId: state => state.user.sessionId,
        username: state => state.user.username,
        friendRequestLength: state => state.friend.friendRequests.length
      }),
      currentCount () {
        let count = 0
        const current = [status.transfer.TRANSFERRING, status.transfer.REQUEST, status.transfer.PENDING, status.transfer.CONNECTING]
        this.$store.state.transfer.transfers.forEach(transfer => {
          if (current.indexOf(transfer.status) !== -1) {
            count = count + 1
          }
        })
        return count
      }
    },
    methods: {
      logout () {
        ipcRenderer.once('loggedOut', (event, packet) => {
          if (packet.status === status.OK || packet.status === status.session.NO_SUCH_SESSION) {
            this.$store.dispatch('updateUserInfo', {
              _id: null,
              username: null,
              sessionId: null
            })
            if (packet.status === status.OK) {
              this.$messageQueue.success('已成功登出')
              this.$store.dispatch('clearSession')
            } else {
              this.$messageQueue.error('会话不存在')
            }
          } else {
            this.$messageQueue.error('登出操作失败，未知错误')
          }
        })
        ipcRenderer.send('logout')
      },
      reconnectServer () {
        if (this.connectionStatus === status.connection.DISCONNECTED) {
          ipcRenderer.send('connectServer')
        }
      }
    }
  }
</script>

<style scoped>
  .menu-logo {
    font-size: 18px;
  }
  .menu-item {
    font-size: 15px;
  }
  .menu-item.menu-item-right {
    float: right;
  }
  .menu-item.menu-item-status {
    display: flex;
    align-content: center;
  }
</style>
