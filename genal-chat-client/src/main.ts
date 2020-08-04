import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import VViewer from 'v-viewer';

Vue.config.productionTip = false;

// 引入ant-desigin
import './ant-desigin';

// 引入moment
import moment from 'moment';
import 'moment/locale/zh-cn';

// 使用中文时间
moment.locale('zh-cn');
Vue.prototype.$moment = moment;

// 图片预览插件
import 'viewerjs/dist/viewer.css';
Vue.use(VViewer);

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');
