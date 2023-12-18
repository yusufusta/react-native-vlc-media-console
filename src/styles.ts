import {StyleSheet} from 'react-native';

export const _styles = {
  player: StyleSheet.create({
    container: {
      overflow: 'hidden',
      backgroundColor: '#000',
      flex: 1,
    },
    video: {
      overflow: 'hidden',
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    channelList: {
      position: 'absolute',
      top: 60,
      right: 60,
      bottom: 60,
      width: 250,
      height: 220,
      backgroundColor: 'rgba(42,42,42, 0.8)',
      borderRadius: 20,
    },
    channelListContainer: {
      flex: 1,
      padding: 10,
    },
    channel:{
      backgroundColor: 'rgba(42,42,42,0.5)',
      borderRadius: 10,
      marginBottom: 2,
      marginTop: 5,
      padding: 10,
      flexDirection: 'row',
    },
    channelIcon: {
      flex:0.2,
      marginRight: 10,
    },
    channelIconImage: {
      width: 35,
      height: 35,
    },
    channelTitle: {
      color: '#fff',
    },
    channelName: {
      color: '#fff',
      textAlign: 'center',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "Ubuntu-Regular",
    },
    channelInfo: {
      justifyContent: 'center',
      flex: 0.8,
    },
    channelListTitle: {
      color: '#fff',
      fontSize: 20,
      marginBottom: 10,
      fontFamily: "Ubuntu-Medium",
    },
  }),
};
