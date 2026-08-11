import { StyleSheet, Text, View, type ViewProps} from "react-native";

import { Message } from "./chat-box";

export type MessageBubbleProps = ViewProps & {
  message: Message;
  type?: "text" | "anotherType";
  isOwn: boolean;
};

export function MessageBubble({
  style,
  message ,
  type = "text",
  ...rest
}: MessageBubbleProps) {

  return (
    <View>
      <Text
        style={[
          type === "text" ? styles.text : undefined,
          // style,
        ]}
        {...rest}
        >
          {message.content}
        </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    color: "#fff",

  }
});
