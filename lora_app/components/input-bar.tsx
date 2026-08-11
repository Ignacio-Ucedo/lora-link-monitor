import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useState } from "react";
import { TextInput, View, type ViewProps } from "react-native";
import { AppButton } from "./app-button";
import { IconSymbol } from "./ui/icon-symbol";

export type InputBarProps = ViewProps & {
  onSend?: (content: string) => void;
};

export function InputBar({ style, onSend, ...otherProps }: InputBarProps) {
  const theme = useColorScheme() ?? "light";
  const backgroundColor = Colors[theme]["background"];
  const borderColor = Colors[theme]["border"];
  const blue = Colors[theme]["blue"];

  const [input, setInput] = useState("");

  return (
    <View
      style={[
        {
          flexDirection: "row",
          height: 46,
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 2,
        },
      ]}
    >
      <TextInput
        placeholder="Escribí un mensaje..."
        style={[
          {
            flex: 1,
            backgroundColor,
            borderRadius: 8,
            borderWidth: 1,
            borderColor,
            paddingHorizontal: 12,
          },
        ]}
        onChangeText={(text) => setInput(text)}
        onSubmitEditing={() => onSend?.(input)}
      />
      <View style={[{ padding: 4, paddingLeft: 0 }]}>
        <AppButton
          onPress={() => onSend?.(input)}
          padding={0}
          style={[{ height: "100%", aspectRatio: "4/3", alignItems: "center" }]}
        >
          <IconSymbol
            style={[
              {
                paddingLeft: 4,
              },
            ]}
            size={20}
            name="paperplane.fill"
            color={blue}
          />
        </AppButton>
      </View>
    </View>
  );
}
