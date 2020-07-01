import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../user/entity/user.entity';
import { Group } from './entity/group.entity'
import { GroupMessage } from './entity/groupMessage.entity'
import { Friend } from './entity/friend.entity'
import { FriendMessage } from './entity/friendMessage.entity'


@WebSocketGateway({namespace:'chat'})
export class ChatGateway {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMessage)
    private readonly gmRepository: Repository<GroupMessage>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @InjectRepository(FriendMessage)
    private readonly fmRepository: Repository<FriendMessage>,
  ) {}

  @WebSocketServer()
  server: Server

  // socket连接钩子
  async handleConnection(client: Socket): Promise<string> {
    let defaultGroup = await this.groupRepository.find({groupname: 'public'})
    if(!defaultGroup.length) {
      this.groupRepository.save({
        groupId: 'public',
        groupname: 'public',
        userId: 'admin',
        createTime: new Date().valueOf().toString()
      })
    }
    // 连接默认加入public房间
    client.join('public')
    return '连接成功'
  }

  // 创建群组
  @SubscribeMessage('addGroup')
  async addGroup(@ConnectedSocket() client: Socket, @MessageBody() data: Group){
    let isHava = await this.groupRepository.find({groupname: data.groupname})
    client.join(data.groupId)
    if(isHava.length) {
      this.server.to(data.groupId).emit('addGroup', {code: 1, data:'该群已存在'})
      return;
    }
    let group = await this.groupRepository.save(data)
    console.log(group.groupId)
    this.server.to(group.groupId).emit('addGroup', {code: 0, data:group})
  }

  // 加入群组房间
  @SubscribeMessage('joinGroup')
  async joinGroup(@ConnectedSocket() client: Socket, @MessageBody() data: Group) {
    let group = await this.groupRepository.findOne({groupname: data.groupname})
    if(group && group.groupId) {
      data.groupId = group.groupId
      this.groupRepository.save(data)
      client.join(group.groupId)
      let user = await this.userRepository.findOne({userId: data.userId})
      // @ts-ignore;
      user.groupId = group.groupId
      this.server.to(group.groupId).emit('joinGroup', {code: 0, data: user})
    }
  }

  // 接收群消息
  @SubscribeMessage('groupMessage')
  async sendGroupMessage(@MessageBody() data: GroupMessage) {
    if(data.groupId) {
      this.gmRepository.save(data);
      let user = this.userRepository.findOne({userId: data.userId})
      let res: any = {...data}
      res.user = user;
      this.server.to(data.groupId).emit('groupMessage', {code: 0, data: res})
    }
  }

  // 添加好友
  @SubscribeMessage('addFriend')
  async addFriend(@ConnectedSocket() client: Socket, @MessageBody() data: Friend) {
    if(data.friendId && data.userId) {
      let isHave = await this.friendRepository.find({userId: data.userId, friendId: data.friendId})
      console.log(isHave)
      if(isHave.length) {
        this.server.emit('addFriend', {code: 1, data: '已经有该好友'})
        return;
      }
      let roomId = data.userId > data.friendId ?  data.userId + data.friendId : data.friendId + data.userId
      let friend = await this.userRepository.find({userId: data.friendId});
      if(!friend.length) {
        this.server.emit('addFriend', {code: 1, data: '该好友不存在'})
        return;
      }
      // 双方都添加好友 并存入数据库
      await this.friendRepository.save(data)
      let friendData = JSON.parse(JSON.stringify(data))
      let friendId = friendData.friendId
      friendData.friendId = friendData.userId
      friendData.userId = friendId
      delete friendData.id
      await this.friendRepository.save(friendData)
      client.join(roomId)
      console.log(data, friendData)
      console.log(await this.friendRepository.find())
      this.server.emit('addFriend', {code: 0, data})
    }
  }

  // 进入私聊房间
  @SubscribeMessage('joinFriend')
  async joinFriend(@ConnectedSocket() client: Socket, @MessageBody() data: Friend) {
    if(data.friendId && data.userId) {
      let roomId = data.userId > data.friendId ?  data.userId + data.friendId : data.friendId + data.userId
      client.join(roomId)
    }
  }

  // 发送私聊消息
  @SubscribeMessage('friendMessage')
  async friendMessage(@MessageBody() data: FriendMessage) {
    if(data.from && data.to) {
      // console.log(data)
      let roomId = data.from > data.to ? data.from + data.to : data.to + data.from
      await this.fmRepository.save(data)
      this.server.to(roomId).emit('friendMessage', {code: 0, data})
    }
  }
}
