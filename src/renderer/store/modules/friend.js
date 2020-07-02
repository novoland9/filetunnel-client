const state = {
  friends: [],
  friendRequests: []
}

const mutations = {
  updateFriendList (state, { friends }) {
    state.friends = friends
  },
  updateFriendRequests (state, { friendRequests }) {
    state.friendRequests = friendRequests
  },
  removeFriendRequests (state, _id) {
    state.friendRequests = state.friendRequests.filter(friendRequest => friendRequest._id === _id)
  }
}

const actions = {
  updateFriendList ({ commit }, { friends }) {
    commit('updateFriendList', { friends })
  },
  updateFriendRequests ({ commit }, { friendRequests }) {
    commit('updateFriendRequests', { friendRequests })
  },
  removeFriendRequests ({ commit }, _id) {
    commit('removeFriendRequests', _id)
  }
}

export default {
  state,
  mutations,
  actions
}
