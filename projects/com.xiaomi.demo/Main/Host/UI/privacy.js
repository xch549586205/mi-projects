'use strict';

import { Host } from "miot";
import Switch from 'miot/ui/Switch';
import React from 'react';
import { ActionSheetIOS, Image, ListView, PixelRatio, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import ProtocolManager from "miot/utils/protocol-helper";
import Logger from '../../Logger';

let BUTTONS = [
  '测试对话框',
  '确定'
];

export default class PrivacyDemo extends React.Component {

  constructor(props) {
    super(props);
    let ds = new ListView.DataSource({
      rowHasChanged: (r1, r2) => r1 !== r2
    });
    this._createMenuData();
    this.state = {
      dataSource: ds.cloneWithRows(this._menuData.map((o) => (o.name))),
      agreement: true,
      privacy: true,
      hideAgreement: false,
      hideUserExperiencePlan: false,
      experience: true
    };
    Logger.trace(this);
  }

  _createMenuData() {
    this._menuData = [
      {
        'name': '请求用户协议与隐私政策授权-推荐',
        'func': () => {
          const licenseURL = require('../../../Resources/raw/license_zh.html');
          const privacyURL = require('../../../Resources/raw/privacy_zh.html');
          let options = {};
          if (this.state.agreement) {
            options.agreementURL = licenseURL;
          }
          if (this.state.privacy) {
            options.privacyURL = privacyURL;
          }

          if (this.state.experience) {
            options.experiencePlanURL = licenseURL;
          }
          options.hideAgreement = this.state.hideAgreement;
          options.hideUserExperiencePlan = this.state.hideUserExperiencePlan;

          ProtocolManager.setLegalInfoAuthHasShowed(false); // 这里作为demo需要强制显示，所以需要将该值置为false，实际生产环境中不应该这样做
          // 这是为了演示需要，使用的是强制弹出的模式 具体使用方法可以参考iot文档 或 com.xiaomi.demo/MainPage.js部分样例
          Host.ui.alertLegalInformationAuthorization(options).then((res) => {
            console.log("res", res);
            if (res) {
              // 表示用户同意授权
              // Host.storage.set('licenseKey', true).then(() => { });
            }
          }).catch((error) => {
            console.log(error);
          });
        }
      },
      {
        'name': '预览用户协议与隐私授权-推荐',
        'func': () => {
          const licenseURL = require('../../../Resources/raw/license_zh.html');
          const privacyURL = require('../../../Resources/raw/privacy_zh.html');
          let options = {};
          if (this.state.agreement) {
            options.agreementURL = licenseURL;
          }

          if (this.state.privacy) {
            options.privacyURL = privacyURL;
          }

          if (this.state.experience) {
            options.experiencePlanURL = licenseURL;
          }
          options.hideAgreement = this.state.hideAgreement;
          options.hideUserExperiencePlan = this.state.hideUserExperiencePlan;

          Host.ui.previewLegalInformationAuthorization(options).then((res) => {
            console.log("res", res);
            if (res) {
              // 表示用户同意授权
              // Host.storage.set('licenseKey', true).then(() => { });
            }
          }).catch((error) => {
            console.log(error);
          });
        }
      }
    ];
  }

  render() {
    return (
      <View style={styles.container}>
        <View style={[{ flexDirection: "column", alignItems: 'center', padding: 20 }]}>
          <Text>自定义用户协议</Text>
          <Switch
            style={{ width: 50, height: 25 }}
            onTintColor="skyblue"
            tintColor="lightgray"
            value={this.state.agreement}
            onValueChange={(value) => this.setState({ agreement: value })}
          />
          <Text>自定义隐私协议</Text>
          <Switch
            style={{ width: 50, height: 25 }}
            onTintColor="skyblue"
            tintColor="lightgray"
            value={this.state.privacy}
            onValueChange={(value) => this.setState({ privacy: value })}
          />
          <Text>隐藏用户协议</Text>
          <Switch
            style={{ width: 50, height: 25 }}
            onTintColor="skyblue"
            tintColor="lightgray"
            value={this.state.hideAgreement}
            onValueChange={(value) => this.setState({ hideAgreement: value })}
          />
          <Text>隐藏体验计划</Text>
          <Switch
            style={{ width: 50, height: 25 }}
            onTintColor="skyblue"
            tintColor="lightgray"
            value={this.state.hideUserExperiencePlan}
            onValueChange={(value) => this.setState({ experience: !value, hideUserExperiencePlan: value })}
          />
        </View>
        <ListView style={styles.list} dataSource={this.state.dataSource} renderRow={this._renderRow.bind(this)} />
      </View>
    );
  }

  _renderRow(rowData, sectionID, rowID) {
    return (
      <TouchableHighlight underlayColor="#838383" onPress={() => this._pressRow(rowID)}>
        <View>
          <View style={styles.rowContainer}>
            <Text style={styles.title}>{rowData}</Text>
            <Image style={styles.subArrow} source={require("../../../Resources/sub_arrow.png")} />
          </View>
          <View style={styles.separator}></View>
        </View>
      </TouchableHighlight>
    );
  }

  _pressRow(rowID) {
    console.log(`row${ rowID }clicked!`);
    this._menuData[rowID].func();
    Logger.trace(this, this._pressRow, this._menuData[rowID]);
  }

  showActionSheet() {
    if (Host.isIOS)
      ActionSheetIOS.showActionSheetWithOptions({
        options: BUTTONS,
        destructiveButtonIndex: 1
      },
      () => { });
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderTopColor: '#f1f1f1',
    borderTopWidth: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 0,
    marginTop: 0
  },
  rowContainer: {
    height: 52,
    alignSelf: 'stretch',
    flexDirection: 'row',
    paddingLeft: 23,
    paddingRight: 23,
    alignItems: 'center'
  },
  list: {
    flex: 1,
    alignSelf: 'stretch'
  },
  title: {
    fontSize: 15,
    color: '#333333',
    alignItems: 'center',
    flex: 1
  },
  subArrow: {
    width: 7,
    height: 14
  },
  separator: {
    height: 1 / PixelRatio.get(),
    backgroundColor: '#e5e5e5',
    marginLeft: 20
  }
});
