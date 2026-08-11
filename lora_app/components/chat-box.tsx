import { View, FlatList, type ViewProps, StyleSheet} from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { InputBar } from './input-bar';

import { useRef, useState } from "react";
import { MessageBubble } from './message-bubble';


export type ChatBoxProps = ViewProps; 

{
  /*
  id
  
  senderId
  
  timestamp
  
  content
  
  status 
  
  type
  
  */
}
export type Message = {
  id: number;
  senderId: string;
  timestamp: string;
  content: string;
  status: string;
  type: string;
};

export function ChatBox({ style, ...otherProps }: ChatBoxProps) {
  const theme = useColorScheme() ?? 'light';
  const backgroundColor = Colors[theme]["background"]
  const borderColor = Colors[theme]["border"]

  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  var currentMessageId= 1;  
  const handleSend = (content: string) => {

    currentMessageId++; 
    const newMessage = {
      id: currentMessageId,
      senderId: "me",
      timestamp: new Date().toISOString(),
      content: content,
      status: "sent",
      type: "text"
    }
    setMessages(prev => [...prev, newMessage])
  }


  return  <View style={[styles.chatWrapper]} {...otherProps}>

  <View style={[styles.chatBox, { backgroundColor, borderColor }, style]}>

    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item, index) => index.toString()}
      renderItem={({ item }) => (
        // <MessageBubble message={item} isOwn={item.senderId === currentUserId}/>
        <MessageBubble message={item} isOwn={true}/>
      )}
      contentContainerStyle={{ padding: 8 }}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() =>
        flatListRef.current?.scrollToEnd({ animated: true })
      }
      style={{ flex: 1 }}
    />

  </View>
  <InputBar onSend={handleSend} />

</View> ;

}

const styles = StyleSheet.create({
  chatWrapper: {
    flex: 1,
    gap: 6,

  },
  chatBox: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "flex-end",
    overflow: "hidden",
  }
});

